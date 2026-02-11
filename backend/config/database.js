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
    console.log('='.repeat(80));
    console.log('EXECUTEQUERY INICIADO');
    console.log('SQL (primeros 300 chars):', sql.substring(0, 300));
    console.log('Params:', params);
    console.log('='.repeat(80));

    const [rows] = await pool.execute(sql, params);

    console.log('Query ejecutada exitosamente');
    console.log('Filas afectadas:', rows.affectedRows || rows.length);
    console.log('='.repeat(80));

    return rows;
  };

  try {
    const rows = await performQuery();
    return { success: true, data: rows };
  } catch (error) {
    const retryCodes = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'CANNOT_CONNECT'];
    
    if (retryCodes.includes(error.code)) {
      console.warn(`⚠️ Error de conexión detectado (${error.code}). Reintentando consulta...`);
      try {
        const rows = await performQuery();
        console.log('✅ Reintento exitoso');
        return { success: true, data: rows };
      } catch (retryError) {
        return handleExecuteError(retryError, sql, params);
      }
    }

    return handleExecuteError(error, sql, params);
  }
}

function handleExecuteError(error, sql, params) {
  console.error('='.repeat(80));
  console.error('ERROR EN EXECUTEQUERY');
  console.error('SQL completo:', sql);
  console.error('Params:', params);
  console.error('Error message:', error.message);
  console.error('Error code:', error.code);
  console.error('SQL State:', error.sqlState);
  console.error('SQL original del error:', error.sql);
  console.error('Stack trace:');
  console.error(error.stack);
  console.error('='.repeat(80));

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
    console.log('='.repeat(80));
    console.log('🔵 TRANSACCIÓN INICIADA');
    console.log('📊 Número de queries:', queries.length);
    console.log('='.repeat(80));
    
    await connection.beginTransaction();
    
    const results = [];
    for (let i = 0; i < queries.length; i++) {
      const { sql, params } = queries[i];
      
      console.log(`Query ${i + 1}/${queries.length}:`);
      console.log('SQL (primeros 200 chars):', sql.substring(0, 200));
      console.log('Params:', params);
      
      const [rows] = await connection.execute(sql, params);
      results.push(rows);
      
      console.log(`Query ${i + 1} ejecutada - Filas afectadas:`, rows.affectedRows || 0);
    }
    
    await connection.commit();
    console.log('TRANSACCIÓN COMMIT EXITOSO');
    console.log('='.repeat(80));
    
    return { success: true, data: results };
  } catch (error) {
    await connection.rollback();

    console.error('='.repeat(80));
    console.error('ERROR EN TRANSACCIÓN - ROLLBACK EJECUTADO');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('SQL State:', error.sqlState);
    console.error('SQL del error:', error.sql);
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('='.repeat(80));
    
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

export default pool;