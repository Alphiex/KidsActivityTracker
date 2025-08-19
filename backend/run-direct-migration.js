const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔄 Running database migration for sessions and prerequisites...');
  
  // Read the migration SQL
  const migrationSQL = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');
  
  // Use psql command to run the migration
  const databaseUrl = 'postgresql://postgres:KidsTracker2024!@34.42.149.102/kidsactivity';
  
  // Create a temporary file with the SQL
  const tempFile = path.join(__dirname, 'temp-migration.sql');
  fs.writeFileSync(tempFile, migrationSQL);
  
  // Run psql with the file
  const command = `psql "${databaseUrl}" -f "${tempFile}"`;
  
  exec(command, (error, stdout, stderr) => {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('stderr:', stderr);
      process.exit(1);
    }
    
    console.log('✅ Migration output:', stdout);
    console.log('✅ Migration completed successfully!');
  });
}

// Check if psql is available
exec('which psql', (error) => {
  if (error) {
    console.error('❌ psql command not found. Please install PostgreSQL client tools.');
    console.log('   On macOS: brew install postgresql');
    console.log('   On Ubuntu: sudo apt-get install postgresql-client');
    process.exit(1);
  }
  
  runMigration();
});