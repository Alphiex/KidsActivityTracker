const { PrismaClient } = require('../generated/prisma');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('🚀 Starting database migration...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`🔗 Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
    
    // Read migration SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-is-updated-column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration: add-is-updated-column.sql');
    
    // Split SQL into individual statements and run them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await prisma.$executeRawUnsafe(statement);
    }
    
    // Verify the column was added
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'Activity' AND column_name = 'isUpdated'
    `;
    
    if (result.length > 0) {
      console.log('✅ Migration completed successfully!');
      console.log('Column details:', result[0]);
    } else {
      throw new Error('Column was not created');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});