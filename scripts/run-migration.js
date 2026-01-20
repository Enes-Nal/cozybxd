/**
 * Script to run SQL migrations on Supabase
 * Usage: node scripts/run-migration.js <migration-file>
 * Example: node scripts/run-migration.js add-friend-requests-migration.sql
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  console.error('Example: node scripts/run-migration.js add-friend-requests-migration.sql');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`Error: Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

async function runMigration() {
  console.log(`Running migration: ${migrationFile}...`);
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Split SQL by semicolons and execute each statement
  // Note: Supabase doesn't have a direct SQL execution endpoint via JS client
  // This would require using the REST API or psql
  console.log('\n⚠️  Note: Supabase JS client cannot execute raw SQL directly.');
  console.log('Please run this migration in the Supabase Dashboard SQL Editor instead.');
  console.log('\nSQL to run:');
  console.log('─'.repeat(50));
  console.log(sql);
  console.log('─'.repeat(50));
  console.log('\nOr use psql:');
  console.log(`psql "${process.env.DATABASE_URL}" -f ${migrationPath}`);
}

runMigration().catch(console.error);


