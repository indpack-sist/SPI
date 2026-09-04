import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'indpack',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000,
  timezone: '-05:00'
});

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT @@session.time_zone as tz");
    console.log('✓ Conexión exitosa a la base de datos MySQL');
    console.log('✓ Zona horaria configurada:', rows[0].tz);
    connection.release();
    return true;
  } catch (error) {
    console.error('✗ Error al conectar con la base de datos:', error.message);
    return false;
  }
}

export async function executeQuery(sql, params = []) {
  const performQuery = async () => {
    const startedAt = Date.now();
    const [rows] = await pool.execute(sql, params);
    const duration = Date.now() - startedAt;
    const slowQueryMs = Number.parseInt(process.env.SLOW_QUERY_MS || '500', 10);
    if (duration >= slowQueryMs) {
      console.warn(`Consulta lenta: ${duration}ms`, sql.replace(/\s+/g, ' ').trim().substring(0, 200));
    }
    return rows;
  };

  try {
    const rows = await performQuery();
    return { success: true, data: rows };
  } catch (error) {
    const retryCodes = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'CANNOT_CONNECT'];
    
    if (retryCodes.includes(error.code)) {
      console.warn(`Error de conexión ${error.code}. Reintentando consulta.`);
      try {
        const rows = await performQuery();
        return { success: true, data: rows };
      } catch (retryError) {
        return handleExecuteError(retryError, sql);
      }
    }

    return handleExecuteError(error, sql);
  }
}

function handleExecuteError(error, sql) {
  console.error('Error de base de datos:', error.code || error.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(sql);
    console.error(error.stack);
  }

  return { 
    success: false, 
    error: error.message, 
    code: error.code, 
    sqlState: error.sqlState, 
    sql: error.sql
  };
}

export async function executeTransaction(queries) {
  const connection = await pool.getConnection();
  try {
    const startedAt = Date.now();
    await connection.beginTransaction();
    
    const results = [];
    for (let i = 0; i < queries.length; i++) {
      const { sql, params } = queries[i];
      const [rows] = await connection.execute(sql, params);
      results.push(rows);
    }
    
    await connection.commit();
    const duration = Date.now() - startedAt;
    const slowQueryMs = Number.parseInt(process.env.SLOW_TRANSACTION_MS || '1000', 10);
    if (duration >= slowQueryMs) {
      console.warn(`Transacción lenta: ${duration}ms, ${queries.length} consultas`);
    }
    
    return { success: true, data: results };
  } catch (error) {
    await connection.rollback();

    console.error('Error en transacción:', error.code || error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error(error.stack);
    }
    
    return { 
      success: false, 
      error: error.message, 
      code: error.code, 
      sqlState: error.sqlState, 
      sql: error.sql
    };
  } finally {
    connection.release();
  }
}

/**
 * Ejecuta un callback dentro de una transacción MySQL sobre UNA sola conexión.
 * El callback recibe la conexión (para usar conn.query con FOR UPDATE, leer insertId,
 * decidir lógica y encadenar más queries). Hace commit si resuelve, rollback si lanza.
 *
 *   const r = await withTransaction(async (conn) => {
 *     const [[ov]] = await conn.query('SELECT * FROM ordenes_venta WHERE id=? FOR UPDATE', [id]);
 *     ...
 *     return algo;
 *   });
 *
 * No sustituye a executeTransaction (que recibe un array de queries pre-armadas);
 * es un helper NUEVO para los flujos SUNAT que necesitan lógica entre queries.
 */
export async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default pool;
