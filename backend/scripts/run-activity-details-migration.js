require('dotenv').config({ path: '.env.production' });

const { PrismaClient } = require('../generated/prisma');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const prisma = new PrismaClient();
  
  console.log('🚀 Starting activity details migration...');
  console.log('📊 Checking current database schema...\n');
  
  try {
    // First, check if migration is needed by checking if columns exist
    const checkQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'Activity'
        AND column_name IN (
          'registrationEndDate', 
          'registrationEndTime', 
          'costIncludesTax', 
          'taxAmount',
          'startTime',
          'endTime',
          'courseDetails',
          'totalSpots'
        )
      ORDER BY column_name;
    `;
    
    const existingColumns = await prisma.$queryRawUnsafe(checkQuery);
    
    if (existingColumns.length > 0) {
      console.log('⚠️  Some columns already exist:');
      existingColumns.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
      console.log('\n');
    } else {
      console.log('✅ No conflicting columns found, proceeding with migration...\n');
    }
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-detailed-activity-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration SQL...');
    
    // Split the SQL into individual statements and run them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
        console.log(`\n   Executing: ${statement.substring(0, 50)}...`);
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log('   ✅ Success');
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log('   ⚠️  Already exists, skipping');
          } else {
            throw error;
          }
        }
      }
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const verifyQuery = `
      SELECT 
        column_name,
        data_type,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'Activity'
        AND column_name IN (
          'registrationEndDate', 
          'registrationEndTime', 
          'costIncludesTax', 
          'taxAmount',
          'startTime',
          'endTime',
          'courseDetails',
          'totalSpots'
        )
      ORDER BY column_name;
    `;
    
    const newColumns = await prisma.$queryRawUnsafe(verifyQuery);
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Added ${newColumns.length} new columns to Activity table:`);
    newColumns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Check ActivitySession table
    console.log('\n🔍 Checking ActivitySession table...');
    const sessionCheckQuery = `
      SELECT 
        column_name,
        data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'ActivitySession'
        AND column_name IN ('dayOfWeek', 'subLocation')
      ORDER BY column_name;
    `;
    
    const sessionColumns = await prisma.$queryRawUnsafe(sessionCheckQuery);
    console.log(`📊 ActivitySession columns: ${sessionColumns.length} fields`);
    sessionColumns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Show some statistics
    console.log('\n📈 Database statistics:');
    const stats = await prisma.activity.aggregate({
      _count: true
    });
    console.log(`   Total activities: ${stats._count}`);
    
    const sessionsCount = await prisma.activitySession.count();
    console.log(`   Total activity sessions: ${sessionsCount}`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Deploy the updated scraper');
    console.log('   2. Run a test scrape to populate new fields');
    console.log('   3. Monitor performance and data quality');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration().catch(console.error);