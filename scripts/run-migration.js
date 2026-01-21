/**
 * Script to run SQL migrations on Supabase
 * Usage: node scripts/run-migration.js <migration-file>
 * Example: node scripts/run-migration.js migrations/complete-schema.sql
 * Example: node scripts/run-migration.js migrations/archive/add-friend-requests-migration.sql
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!databaseUrl) {
  console.error('Error: Missing DATABASE_URL or DIRECT_URL environment variable');
  console.error('Make sure DATABASE_URL or DIRECT_URL is set in .env.local');
  process.exit(1);
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  console.error('Example: node scripts/run-migration.js migrations/complete-schema.sql');
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
  
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Execute the SQL
    await client.query(sql);
    console.log('✅ Migration executed successfully!');

    await client.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    await client.end();
    process.exit(1);
  }
}

runMigration().catch(console.error);


