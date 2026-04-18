import pool from './backend/config/database.js';

async function checkSchema() {
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM ordenes_compra");
    rows.forEach(row => {
        console.log(`${row.Field}: ${row.Type} (Null: ${row.Null}, Key: ${row.Key}, Default: ${row.Default}, Extra: ${row.Extra})`);
    });
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
