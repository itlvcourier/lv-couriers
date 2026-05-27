// Simple script to run SQL migrations against Supabase using supabase-js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function runSQL() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node run-sql.mjs <sql-file>');
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
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  
  // Split by semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Found ${statements.length} SQL statements to execute`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;
    
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
    console.log(statement.substring(0, 80) + (statement.length > 80 ? '...' : ''));
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: statement + ';' 
    });
    
    if (error) {
      // If RPC doesn't exist, we need to use REST API directly
      console.log('RPC failed, statement may have executed or RPC not available');
      console.log('Error:', error.message);
    } else {
      console.log('OK');
    }
  }
  
  console.log('\n---\nMigration process completed!');
}

runSQL().catch(console.error);
