// Simple script to run SQL migrations against Supabase
const fs = require('fs');
const path = require('path');

async function runSQL() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node run-sql.js <sql-file>');
    process.exit(1);
  }
  
  const sqlPath = path.resolve(sqlFile);
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Running SQL from: ${sqlFile}`);
  console.log('---');
  
  // Use Supabase REST API to execute SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (!response.ok) {
    // Try direct postgres if RPC doesn't exist
    console.log('RPC not available, trying direct query...');
    
    // Use pg module
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
    });
    
    try {
      await pool.query(sql);
      console.log('Migration completed successfully!');
    } catch (err) {
      console.error('Migration failed:', err.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  } else {
    console.log('Migration completed successfully!');
  }
}

runSQL().catch(console.error);
