  import { executeQuery, executeTransaction } from '../config/database.js';
  import { generarPDFOrdenProduccion } from '../utils/pdf-generator.js';

  export async function getAllOrdenes(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        op.id_orden,
        op.numero_orden,
        op.id_producto_terminado,
        p.codigo AS codigo_producto,
        COALESCE(p.nombre, '[PRODUCTO ELIMINADO]') AS producto,
        p.unidad_medida,
        op.cantidad_planificada,
        op.cantidad_producida,
        op.id_supervisor,
        e.nombre_completo AS supervisor,
        op.costo_materiales,
        op.estado,
        op.fecha_creacion,
        op.fecha_inicio,
        op.fecha_fin,
        op.tiempo_total_minutos,
        op.observaciones,
        op.id_receta_producto,
        op.rendimiento_unidades,
        rp.nombre_receta,
        CASE 
          WHEN op.id_receta_producto IS NULL AND op.costo_materiales = 0 THEN 1
          ELSE 0
        END AS es_manual,
        CASE 
          WHEN p.id_producto IS NULL THEN 1
          ELSE 0
        END AS producto_eliminado
      FROM ordenes_produccion op
      LEFT JOIN productos p ON op.id_producto_terminado = p.id_producto
      LEFT JOIN empleados e ON op.id_supervisor = e.id_empleado
      LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
    const estadosArray = estado.split(','); // Convierte "Pendiente,En Proceso" en ["Pendiente", "En Proceso"]
    const placeholders = estadosArray.map(() => '?').join(','); // Crea "?,?"
    sql += ` AND op.estado IN (${placeholders})`;
    params.push(...estadosArray); // Agrega cada estado individualmente
}
    
    if (fecha_inicio) {
      sql += ' AND DATE(op.fecha_creacion) >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND DATE(op.fecha_creacion) <= ?';
      params.push(fecha_fin);
    }
    
    sql += ' ORDER BY op.fecha_creacion DESC';
    
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

  export async function getOrdenById(req, res) {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT 
        op.*,
        p.codigo AS codigo_producto,
        COALESCE(p.nombre, '[PRODUCTO ELIMINADO]') AS producto,
        p.unidad_medida,
        e.nombre_completo AS supervisor,
        rp.nombre_receta,
        rp.descripcion AS descripcion_receta,
        CASE 
          WHEN op.id_receta_producto IS NULL AND op.costo_materiales = 0 THEN 1
          ELSE 0
        END AS es_manual,
        CASE 
          WHEN p.id_producto IS NULL THEN 1
          ELSE 0
        END AS producto_eliminado
      FROM ordenes_produccion op
      LEFT JOIN productos p ON op.id_producto_terminado = p.id_producto
      LEFT JOIN empleados e ON op.id_supervisor = e.id_empleado
      LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
      WHERE op.id_orden = ?
    `;
    
    const result = await executeQuery(sql, [id]);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'Orden de producción no encontrada' });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
  // =====================================================
// REEMPLAZAR ESTA FUNCIÓN EN:
// backend/controllers/ordenes-produccion.controller.js
// =====================================================

export async function getConsumoMaterialesOrden(req, res) {
  try {
    const { id } = req.params;
    
    // Primero verificar el estado de la orden
    const ordenResult = await executeQuery(
      'SELECT estado, id_receta_producto FROM ordenes_produccion WHERE id_orden = ?',
      [id]
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    const orden = ordenResult.data[0];
    
    // Si la orden ya inició, obtener de op_consumo_materiales
    if (orden.estado !== 'Pendiente') {
      const sql = `
        SELECT 
          cm.id_consumo,
          cm.id_orden,
          cm.id_insumo,
          p.codigo AS codigo_insumo,
          p.nombre AS insumo,
          p.unidad_medida,
          cm.cantidad_requerida,
          cm.costo_unitario,
          cm.costo_total,
          cm.fecha_consumo
        FROM op_consumo_materiales cm
        INNER JOIN productos p ON cm.id_insumo = p.id_producto
        WHERE cm.id_orden = ?
        ORDER BY p.nombre ASC
      `;
      
      const result = await executeQuery(sql, [id]);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      return res.json({
        success: true,
        data: result.data,
        total: result.data.length
      });
    }
    
    // Si la orden está Pendiente, obtener de la receta
    let sql = '';
    let params = [];
    
    if (orden.id_receta_producto) {
      // Orden con receta existente
      sql = `
        SELECT 
          rd.id_detalle AS id_consumo,
          ? AS id_orden,
          rd.id_insumo,
          p.codigo AS codigo_insumo,
          p.nombre AS insumo,
          p.unidad_medida,
          rd.cantidad_requerida,
          p.costo_unitario_promedio AS costo_unitario,
          (rd.cantidad_requerida * p.costo_unitario_promedio) AS costo_total,
          NULL AS fecha_consumo
        FROM recetas_detalle rd
        INNER JOIN productos p ON rd.id_insumo = p.id_producto
        WHERE rd.id_receta_producto = ?
        ORDER BY p.nombre ASC
      `;
      params = [id, orden.id_receta_producto];
    } else {
      // Orden con receta provisional
      sql = `
        SELECT 
          rp.id_receta_provisional AS id_consumo,
          rp.id_orden,
          rp.id_insumo,
          p.codigo AS codigo_insumo,
          p.nombre AS insumo,
          p.unidad_medida,
          rp.cantidad_requerida,
          p.costo_unitario_promedio AS costo_unitario,
          (rp.cantidad_requerida * p.costo_unitario_promedio) AS costo_total,
          NULL AS fecha_consumo
        FROM op_recetas_provisionales rp
        INNER JOIN productos p ON rp.id_insumo = p.id_producto
        WHERE rp.id_orden = ?
        ORDER BY p.nombre ASC
      `;
      params = [id];
    }
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length,
      estado: orden.estado // Informativo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

  export async function createOrden(req, res) {
    try {
      const {
        numero_orden,
        id_producto_terminado,
        cantidad_planificada,
        id_supervisor,
        observaciones,
        id_receta_producto,
        receta_provisional,
        rendimiento_receta,
        es_orden_manual 
      } = req.body;
      
      // Validaciones básicas
      if (!numero_orden || !id_producto_terminado || !cantidad_planificada || !id_supervisor) {
        return res.status(400).json({ 
          error: 'numero_orden, id_producto_terminado, cantidad_planificada e id_supervisor son requeridos' 
        });
      }
      
      if (cantidad_planificada <= 0) {
        return res.status(400).json({ error: 'La cantidad planificada debe ser mayor a 0' });
      }
      
      const checkNumero = await executeQuery(
        'SELECT * FROM ordenes_produccion WHERE numero_orden = ?',
        [numero_orden]
      );
      
      if (checkNumero.data.length > 0) {
        return res.status(400).json({ error: 'El número de orden ya existe' });
      }
      
      const productoResult = await executeQuery(
        'SELECT requiere_receta, unidad_medida FROM productos WHERE id_producto = ?',
        [id_producto_terminado]
      );
      
      if (productoResult.data.length === 0) {
        return res.status(404).json({ error: 'Producto terminado no encontrado' });
      }
      
      if (!productoResult.data[0].requiere_receta) {
        return res.status(400).json({ 
          error: 'Este producto no requiere producción (es producto de reventa)' 
        });
      }

      if (es_orden_manual === true) {
        const ordenResult = await executeQuery(
          `INSERT INTO ordenes_produccion (
            numero_orden, id_producto_terminado, cantidad_planificada,
            id_supervisor, costo_materiales, estado, observaciones,
            id_receta_producto, rendimiento_unidades
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            numero_orden,
            id_producto_terminado,
            cantidad_planificada,
            id_supervisor,
            0, 
            'Pendiente',
            (observaciones || '') + '\n[ORDEN MANUAL - Sin receta ni consumo de materiales]',
            null, 
            1 
          ]
        );
        
        if (!ordenResult.success) {
          return res.status(500).json({ error: ordenResult.error });
        }
        
        return res.status(201).json({
          success: true,
          message: 'Orden manual creada exitosamente (sin consumo de materiales)',
          data: {
            id_orden: ordenResult.data.insertId,
            numero_orden,
            costo_materiales: 0,
            es_manual: true,
            estado: 'Pendiente'
          }
        });
      }
    
      let recetaData = [];
      let rendimientoUnidades = parseFloat(rendimiento_receta) || 1;
      if (id_receta_producto) {
        const recetaResult = await executeQuery(
          `SELECT 
            rd.id_insumo,
            rd.cantidad_requerida,
            rd.unidad_medida,
            p.costo_unitario_promedio,
            p.stock_actual,
            p.id_tipo_inventario,
            rp.rendimiento_unidades
          FROM recetas_detalle rd
          INNER JOIN recetas_productos rp ON rd.id_receta_producto = rp.id_receta_producto
          INNER JOIN productos p ON rd.id_insumo = p.id_producto
          WHERE rd.id_receta_producto = ?`,
          [id_receta_producto]
        );
        
        if (recetaResult.data.length === 0) {
          return res.status(400).json({ error: 'La receta seleccionada no tiene insumos configurados' });
        }
        
        recetaData = recetaResult.data;
        rendimientoUnidades = parseFloat(recetaResult.data[0].rendimiento_unidades) || 1;
      }
      else if (receta_provisional && Array.isArray(receta_provisional) && receta_provisional.length > 0) {
        const insumosIds = receta_provisional.map(i => i.id_insumo);
        
        const insumosResult = await executeQuery(
          `SELECT 
            id_producto,
            costo_unitario_promedio,
            stock_actual,
            id_tipo_inventario,
            unidad_medida
          FROM productos 
          WHERE id_producto IN (${insumosIds.map(() => '?').join(',')})`,
          insumosIds
        );
        
        recetaData = receta_provisional.map(item => {
          const insumo = insumosResult.data.find(i => i.id_producto == item.id_insumo);
          if (!insumo) {
            throw new Error(`Insumo ${item.id_insumo} no encontrado`);
          }
          
          return {
            id_insumo: item.id_insumo,
            cantidad_requerida: parseFloat(item.cantidad_requerida),
            unidad_medida: insumo.unidad_medida,
            costo_unitario_promedio: parseFloat(insumo.costo_unitario_promedio),
            stock_actual: parseFloat(insumo.stock_actual),
            id_tipo_inventario: insumo.id_tipo_inventario
          };
        });
      } else {
        return res.status(400).json({ 
          error: 'Debe proporcionar id_receta_producto, receta_provisional o es_orden_manual' 
        });
      }
      
      const insumosSinCUP = recetaData.filter(i => parseFloat(i.costo_unitario_promedio) === 0);
      if (insumosSinCUP.length > 0) {
        return res.status(400).json({ 
          error: 'Algunos insumos no tienen costo unitario definido. Registre entradas primero.' 
        });
      }
      
      const cantidadPlan = parseFloat(cantidad_planificada);
      const lotesNecesarios = Math.ceil(cantidadPlan / rendimientoUnidades);
      
      let costoMateriales = 0;
      for (const insumo of recetaData) {
        const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
        costoMateriales += cantidadTotal * parseFloat(insumo.costo_unitario_promedio);
      }
      
      const ordenResult = await executeQuery(
        `INSERT INTO ordenes_produccion (
          numero_orden, id_producto_terminado, cantidad_planificada,
          id_supervisor, costo_materiales, estado, observaciones,
          id_receta_producto, rendimiento_unidades
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          numero_orden,
          id_producto_terminado,
          cantidad_planificada,
          id_supervisor,
          costoMateriales,
          'Pendiente',
          observaciones || null,
          id_receta_producto || null,
          rendimientoUnidades
        ]
      );
      
      if (!ordenResult.success) {
        return res.status(500).json({ error: ordenResult.error });
      }
      
      const idOrden = ordenResult.data.insertId;
      
      if (!id_receta_producto && receta_provisional) {
        const queries = receta_provisional.map(item => ({
          sql: `INSERT INTO op_recetas_provisionales (
            id_orden, id_insumo, cantidad_requerida
          ) VALUES (?, ?, ?)`,
          params: [idOrden, item.id_insumo, item.cantidad_requerida]
        }));
        
        await executeTransaction(queries);
      }
      
      res.status(201).json({
        success: true,
        message: 'Orden de producción creada exitosamente',
        data: {
          id_orden: idOrden,
          numero_orden,
          costo_materiales: costoMateriales,
          lotes_necesarios: lotesNecesarios,
          rendimiento_unidades: rendimientoUnidades,
          estado: 'Pendiente'
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  export async function iniciarProduccion(req, res) {
    try {
      const { id } = req.params;
      
      const ordenResult = await executeQuery(
        `SELECT op.*, p.id_tipo_inventario 
        FROM ordenes_produccion op
        INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
        WHERE op.id_orden = ? AND op.estado = ?`,
        [id, 'Pendiente']
      );
      
      if (ordenResult.data.length === 0) {
        return res.status(404).json({ 
          error: 'Orden no encontrada o no está en estado Pendiente' 
        });
      }
      
      const orden = ordenResult.data[0];
      if (orden.id_receta_producto === null && parseFloat(orden.costo_materiales) === 0) {
        const result = await executeQuery(
          `UPDATE ordenes_produccion 
          SET estado = 'En Curso', fecha_inicio = NOW() 
          WHERE id_orden = ?`,
          [id]
        );
        
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        
        return res.json({
          success: true,
          message: 'Orden manual iniciada (sin consumo de materiales)',
          data: {
            estado: 'En Curso',
            es_manual: true,
            materiales_consumidos: 0
          }
        });
      }

      const cantidadPlan = parseFloat(orden.cantidad_planificada);
      const rendimiento = parseFloat(orden.rendimiento_unidades) || 1;
      const lotesNecesarios = Math.ceil(cantidadPlan / rendimiento);
      
      let recetaData = [];
      
      if (orden.id_receta_producto) {
        const recetaResult = await executeQuery(
          `SELECT 
            rd.id_insumo,
            rd.cantidad_requerida,
            p.costo_unitario_promedio,
            p.stock_actual,
            p.id_tipo_inventario
          FROM recetas_detalle rd
          INNER JOIN productos p ON rd.id_insumo = p.id_producto
          WHERE rd.id_receta_producto = ?`,
          [orden.id_receta_producto]
        );
        recetaData = recetaResult.data;
      } else {
        const recetaResult = await executeQuery(
          `SELECT 
            rp.id_insumo,
            rp.cantidad_requerida,
            p.costo_unitario_promedio,
            p.stock_actual,
            p.id_tipo_inventario
          FROM op_recetas_provisionales rp
          INNER JOIN productos p ON rp.id_insumo = p.id_producto
          WHERE rp.id_orden = ?`,
          [id]
        );
        recetaData = recetaResult.data;
      }
      
      const insumosInsuficientes = [];
      for (const insumo of recetaData) {
        const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
        if (parseFloat(insumo.stock_actual) < cantidadTotal) {
          insumosInsuficientes.push({
            id_insumo: insumo.id_insumo,
            requerido: cantidadTotal,
            disponible: insumo.stock_actual
          });
        }
      }
      
      if (insumosInsuficientes.length > 0) {
        return res.status(400).json({ 
          error: 'Stock insuficiente de insumos',
          detalles: insumosInsuficientes
        });
      }
      
      let totalCosto = 0;
      const detallesSalida = [];
      
      for (const insumo of recetaData) {
        const cantidadTotal = parseFloat(insumo.cantidad_requerida) * lotesNecesarios;
        const costoUnitario = parseFloat(insumo.costo_unitario_promedio);
        
        totalCosto += cantidadTotal * costoUnitario;
        
        detallesSalida.push({
          id_insumo: insumo.id_insumo,
          cantidad: cantidadTotal,
          costo_unitario: costoUnitario,
          id_tipo_inventario: insumo.id_tipo_inventario
        });
      }
      
      const queries = [];
      
      queries.push({
        sql: `UPDATE ordenes_produccion 
              SET estado = ?, fecha_inicio = NOW() 
              WHERE id_orden = ?`,
        params: ['En Curso', id]
      });
      
      queries.push({
        sql: `INSERT INTO salidas (
          id_tipo_inventario, tipo_movimiento, departamento, total_costo,
          id_registrado_por, observaciones, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          orden.id_tipo_inventario,
          'Consumo Interno',
          'Producción',
          totalCosto,
          orden.id_supervisor,
          `Consumo para O.P. ${orden.numero_orden}`,
          'Activo'
        ]
      });
      
      const resultParcial = await executeTransaction(queries);
      
      if (!resultParcial.success) {
        return res.status(500).json({ error: resultParcial.error });
      }
      
      const idSalida = resultParcial.data[1].insertId;
      
      const queriesDetalle = [];
      
      for (const detalle of detallesSalida) {
        queriesDetalle.push({
          sql: `INSERT INTO detalle_salidas (
            id_salida, id_producto, cantidad, costo_unitario
          ) VALUES (?, ?, ?, ?)`,
          params: [idSalida, detalle.id_insumo, detalle.cantidad, detalle.costo_unitario]
        });
        
        queriesDetalle.push({
          sql: `INSERT INTO op_consumo_materiales (
            id_orden, id_insumo, cantidad_requerida, costo_unitario
          ) VALUES (?, ?, ?, ?)`,
          params: [id, detalle.id_insumo, detalle.cantidad, detalle.costo_unitario]
        });
        
        queriesDetalle.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
          params: [detalle.cantidad, detalle.id_insumo]
        });
      }
      
      const resultFinal = await executeTransaction(queriesDetalle);
      
      if (!resultFinal.success) {
        await executeQuery(
          'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
          ['Pendiente', id]
        );
        return res.status(500).json({ error: resultFinal.error });
      }
      
      res.json({
        success: true,
        message: 'Producción iniciada exitosamente',
        data: {
          estado: 'En Curso',
          materiales_consumidos: recetaData.length,
          lotes_necesarios: lotesNecesarios,
          id_salida: idSalida,
          total_costo: totalCosto
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  export async function pausarProduccion(req, res) {
    try {
      const { id } = req.params;
      
      const ordenResult = await executeQuery(
        'SELECT * FROM ordenes_produccion WHERE id_orden = ? AND estado = ?',
        [id, 'En Curso']
      );
      
      if (ordenResult.data.length === 0) {
        return res.status(404).json({ 
          error: 'Orden no encontrada o no está en curso' 
        });
      }
      
      const result = await executeQuery(
        'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
        ['En Pausa', id]
      );
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({
        success: true,
        message: 'Producción pausada exitosamente'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  export async function reanudarProduccion(req, res) {
    try {
      const { id } = req.params;
      
      const ordenResult = await executeQuery(
        'SELECT * FROM ordenes_produccion WHERE id_orden = ? AND estado = ?',
        [id, 'En Pausa']
      );
      
      if (ordenResult.data.length === 0) {
        return res.status(404).json({ 
          error: 'Orden no encontrada o no está pausada' 
        });
      }
      
      const result = await executeQuery(
        'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
        ['En Curso', id]
      );
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({
        success: true,
        message: 'Producción reanudada exitosamente'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

export async function finalizarProduccion(req, res) {
  try {
    const { id } = req.params;
    const { 
      cantidad_producida, 
      observaciones,
      mermas  // NUEVO: Array de mermas [{id_producto_merma, cantidad, observaciones}]
    } = req.body;
    
    if (!cantidad_producida || cantidad_producida <= 0) {
      return res.status(400).json({ 
        error: 'La cantidad producida es requerida y debe ser mayor a 0' 
      });
    }
    
    const ordenResult = await executeQuery(
      `SELECT op.*, p.id_tipo_inventario, p.costo_unitario_promedio AS cup_producto
       FROM ordenes_produccion op
       INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
       WHERE op.id_orden = ? AND op.estado IN (?, ?)`,
      [id, 'En Curso', 'En Pausa']
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ 
        error: 'Orden no encontrada o no está en curso/pausa' 
      });
    }
    
    const orden = ordenResult.data[0];
    
    const fechaInicio = new Date(orden.fecha_inicio);
    const fechaFin = new Date();
    const tiempoMinutos = Math.floor((fechaFin - fechaInicio) / (1000 * 60));
    
    let costoUnitario = 0;
    
    if (parseFloat(orden.costo_materiales) > 0) {
      costoUnitario = parseFloat(orden.costo_materiales) / parseFloat(cantidad_producida);
    }
    else if (orden.id_receta_producto) {
      const cupRecetaResult = await executeQuery(
        `SELECT 
           (SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / rp.rendimiento_unidades) AS cup_calculado
         FROM recetas_productos rp
         INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
         INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
         WHERE rp.id_receta_producto = ?
         GROUP BY rp.id_receta_producto, rp.rendimiento_unidades`,
        [orden.id_receta_producto]
      );
      
      if (cupRecetaResult.success && cupRecetaResult.data.length > 0) {
        costoUnitario = parseFloat(cupRecetaResult.data[0].cup_calculado || 0);
      }
    }
    else if (parseFloat(orden.cup_producto) > 0) {
      costoUnitario = parseFloat(orden.cup_producto);
    }
    
    const totalCosto = parseFloat(cantidad_producida) * costoUnitario;
    
    // Preparar queries base
    const queries = [
      {
        sql: `UPDATE ordenes_produccion 
              SET estado = ?, cantidad_producida = ?, fecha_fin = NOW(),
                  tiempo_total_minutos = ?, observaciones = CONCAT(COALESCE(observaciones, ''), '\n', COALESCE(?, ''))
              WHERE id_orden = ?`,
        params: ['Finalizada', cantidad_producida, tiempoMinutos, observaciones, id]
      },
      {
        sql: `INSERT INTO entradas (
          id_tipo_inventario, documento_soporte, total_costo, moneda,
          id_registrado_por, observaciones
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          orden.id_tipo_inventario,
          `O.P. ${orden.numero_orden}`,
          totalCosto,
          'PEN',
          orden.id_supervisor,
          `Producción finalizada - O.P. ${orden.numero_orden}. CUP: S/${costoUnitario.toFixed(4)}`
        ]
      }
    ];
    
    // Ejecutar primera transacción
    const result1 = await executeTransaction(queries);
    
    if (!result1.success) {
      return res.status(500).json({ error: result1.error });
    }
    
    const idEntrada = result1.data[1].insertId;
    
    // Preparar queries de productos
    const queries2 = [
      {
        sql: `INSERT INTO detalle_entradas (
          id_entrada, id_producto, cantidad, costo_unitario
        ) VALUES (?, ?, ?, ?)`,
        params: [idEntrada, orden.id_producto_terminado, cantidad_producida, costoUnitario]
      },
      {
        sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
        params: [cantidad_producida, orden.id_producto_terminado]
      },
      {
        sql: `UPDATE productos 
              SET costo_unitario_promedio = ?
              WHERE id_producto = ? AND (costo_unitario_promedio = 0 OR ? > 0)`,
        params: [costoUnitario, orden.id_producto_terminado, costoUnitario]
      }
    ];
    
    // NUEVO: Procesar mermas si existen
    const mermasRegistradas = [];
    if (mermas && Array.isArray(mermas) && mermas.length > 0) {
      for (const merma of mermas) {
        if (merma.id_producto_merma && merma.cantidad && parseFloat(merma.cantidad) > 0) {
          // Insertar registro de merma
          queries2.push({
            sql: `INSERT INTO mermas_produccion (
              id_orden_produccion, id_producto_merma, cantidad, observaciones
            ) VALUES (?, ?, ?, ?)`,
            params: [
              id,
              merma.id_producto_merma,
              parseFloat(merma.cantidad),
              merma.observaciones || null
            ]
          });
          
          // Agregar merma al stock (las mermas se suman al inventario)
          queries2.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [parseFloat(merma.cantidad), merma.id_producto_merma]
          });
          
          mermasRegistradas.push({
            id_producto: merma.id_producto_merma,
            cantidad: parseFloat(merma.cantidad)
          });
        }
      }
    }
    
    // Ejecutar segunda transacción
    const result2 = await executeTransaction(queries2);
    
    if (!result2.success) {
      return res.status(500).json({ error: result2.error });
    }
    
    res.json({
      success: true,
      message: 'Producción finalizada exitosamente',
      data: {
        cantidad_producida: parseFloat(cantidad_producida),
        tiempo_total_minutos: tiempoMinutos,
        costo_unitario: costoUnitario,
        costo_total: totalCosto,
        mermas_registradas: mermasRegistradas.length,
        detalle_mermas: mermasRegistradas
      }
    });
  } catch (error) {
    console.error('Error al finalizar producción:', error);
    res.status(500).json({ error: error.message });
  }
}

// NUEVO: Obtener productos de merma disponibles
export async function getProductosMerma(req, res) {
  try {
    const result = await executeQuery(
      `SELECT 
        id_producto,
        codigo,
        nombre,
        unidad_medida,
        stock_actual
      FROM productos
      WHERE id_categoria = 10 AND estado = 'Activo'
      ORDER BY nombre`,
      []
    );
    
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
    console.error('Error al obtener productos de merma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// NUEVO: Obtener mermas de una orden
export async function getMermasOrden(req, res) {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      `SELECT * FROM vista_mermas_produccion WHERE id_orden_produccion = ?`,
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
      data: result.data
    });
    
  } catch (error) {
    console.error('Error al obtener mermas de la orden:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

  export async function cancelarOrden(req, res) {
    try {
      const { id } = req.params;
      
      const ordenResult = await executeQuery(
        'SELECT * FROM ordenes_produccion WHERE id_orden = ? AND estado IN (?, ?, ?)',
        [id, 'Pendiente', 'En Curso', 'En Pausa']
      );
      
      if (ordenResult.data.length === 0) {
        return res.status(404).json({ 
          error: 'Orden no encontrada o no puede ser cancelada' 
        });
      }
      
      const orden = ordenResult.data[0];
      
      const consumoResult = await executeQuery(
        `SELECT 
          cm.id_insumo,
          cm.cantidad_requerida,
          cm.costo_unitario,
          p.id_tipo_inventario
        FROM op_consumo_materiales cm
        INNER JOIN productos p ON cm.id_insumo = p.id_producto
        WHERE cm.id_orden = ?`,
        [id]
      );
      
      if (consumoResult.data.length === 0) {
        await executeQuery(
          'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
          ['Cancelada', id]
        );
        
        return res.json({
          success: true,
          message: 'Orden cancelada (sin materiales consumidos)',
          data: { materiales_devueltos: 0 }
        });
      }
      
      const totalCostoDevolucion = consumoResult.data.reduce((sum, item) => 
        sum + (parseFloat(item.cantidad_requerida) * parseFloat(item.costo_unitario)), 0
      );
      
      const queries1 = [
        {
          sql: 'UPDATE ordenes_produccion SET estado = ? WHERE id_orden = ?',
          params: ['Cancelada', id]
        },
        {
          sql: `INSERT INTO entradas (
            id_tipo_inventario, documento_soporte, total_costo,
            id_registrado_por, observaciones
          ) VALUES (?, ?, ?, ?, ?)`,
          params: [
            consumoResult.data[0].id_tipo_inventario,
            `Cancelación O.P. ${orden.numero_orden}`,
            totalCostoDevolucion,
            orden.id_supervisor,
            `Devolución por cancelación de O.P. ${orden.numero_orden}`
          ]
        }
      ];
      
      const result1 = await executeTransaction(queries1);
      
      if (!result1.success) {
        return res.status(500).json({ error: result1.error });
      }
      
      const idEntrada = result1.data[1].insertId;
      
      const queries2 = [];
      
      for (const consumo of consumoResult.data) {
        queries2.push({
          sql: `INSERT INTO detalle_entradas (
            id_entrada, id_producto, cantidad, costo_unitario
          ) VALUES (?, ?, ?, ?)`,
          params: [
            idEntrada,
            consumo.id_insumo,
            consumo.cantidad_requerida,
            consumo.costo_unitario
          ]
        });
        
        queries2.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [consumo.cantidad_requerida, consumo.id_insumo]
        });
      }
      
      const result2 = await executeTransaction(queries2);
      
      if (!result2.success) {
        return res.status(500).json({ error: result2.error });
      }
      
      res.json({
        success: true,
        message: 'Orden cancelada y materiales devueltos al inventario',
        data: {
          materiales_devueltos: consumoResult.data.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  export const generarPDFOrdenController = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 1. Obtener Datos de la Orden (IGUAL QUE ANTES)
    const ordenResult = await executeQuery(`
      SELECT 
        op.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        e.nombre_completo AS supervisor,
        rp.nombre_receta AS nombre_receta
      FROM ordenes_produccion op
      INNER JOIN productos p ON op.id_producto_terminado = p.id_producto
      INNER JOIN empleados e ON op.id_supervisor = e.id_empleado
      LEFT JOIN recetas_productos rp ON op.id_receta_producto = rp.id_receta_producto
      WHERE op.id_orden = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de producción no encontrada' });
    }
    
    const orden = ordenResult.data[0];
    
    // 2. Obtener Materiales (IGUAL QUE ANTES)
    const consumoResult = await executeQuery(`
      SELECT 
        opm.cantidad_requerida,
        opm.costo_unitario,
        opm.costo_total,
        p.nombre AS insumo,
        p.unidad_medida
      FROM op_consumo_materiales opm
      INNER JOIN productos p ON opm.id_insumo = p.id_producto
      WHERE opm.id_orden = ?
      ORDER BY p.nombre
    `, [id]);
    const consumo = consumoResult.success ? consumoResult.data : [];

    // 3. NUEVO: Obtener Mermas (Si existen)
    // Usamos LEFT JOIN para traer el nombre del producto merma
    const mermasResult = await executeQuery(`
      SELECT 
        mp.cantidad,
        mp.observaciones,
        p.codigo,
        p.nombre AS producto_merma,
        p.unidad_medida
      FROM mermas_produccion mp
      INNER JOIN productos p ON mp.id_producto_merma = p.id_producto
      WHERE mp.id_orden_produccion = ?
    `, [id]);
    const mermas = mermasResult.success ? mermasResult.data : [];
    
    // 4. Generar PDF pasando los 3 objetos
    const pdfBuffer = await generarPDFOrdenProduccion(orden, consumo, mermas);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="orden_${orden.numero_orden}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: error.message });
  }
};