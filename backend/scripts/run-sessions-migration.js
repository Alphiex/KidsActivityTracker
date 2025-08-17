const { PrismaClient } = require('../generated/prisma');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Running sessions and prerequisites migration...\n');
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../prisma/migrations/add_sessions_prerequisites.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log('✅ Success\n');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️  Already exists, skipping\n');
        } else {
          throw error;
        }
      }
    }
    
    console.log('📊 Verifying new tables...');
    
    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ActivitySession', 'ActivityPrerequisite')
    `;
    
    console.log('Found tables:', tables);
    
    // Check Activity table columns
    const activityColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Activity' 
      AND column_name IN ('hasMultipleSessions', 'sessionCount', 'hasPrerequisites')
    `;
    
    console.log('Found Activity columns:', activityColumns);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });