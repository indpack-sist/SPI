import pool from './backend/config/database.js';

async function checkSchema() {
  try {
    const [rows] = await pool.query("DESCRIBE ordenes_compra");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
