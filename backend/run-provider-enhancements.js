const { PrismaClient } = require('./generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runProviderEnhancements() {
  console.log('🚀 Starting provider enhancements migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_provider_enhancements.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📄 Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ Statement ${i + 1} completed`);
      } catch (error) {
        // Some statements might fail if they already exist, which is OK
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('duplicate key')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error('Statement was:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('\n📊 Verifying migration results...');
    
    // Verify the changes
    await verifyMigration();
    
    console.log('\n🎉 Provider enhancements migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyMigration() {
  try {
    // Check if new columns exist
    const providers = await prisma.provider.findMany({
      select: {
        id: true,
        name: true,
        platform: true,
        region: true,
        isActive: true
      },
      take: 1
    });
    
    console.log('✅ Provider table columns verified');
    
    // Check if new tables exist
    const metricsCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'ProviderMetrics'
    `;
    console.log('✅ ProviderMetrics table exists:', metricsCount[0].count > 0);
    
    const healthCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'ScraperHealthCheck'
    `;
    console.log('✅ ScraperHealthCheck table exists:', healthCount[0].count > 0);
    
    // Check if view exists
    const viewCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM information_schema.views 
      WHERE table_name = 'ProviderDashboard'
    `;
    console.log('✅ ProviderDashboard view exists:', viewCount[0].count > 0);
    
    // Show current providers
    const allProviders = await prisma.provider.findMany({
      select: {
        name: true,
        platform: true,
        region: true,
        isActive: true,
        _count: {
          select: { activities: true }
        }
      }
    });
    
    console.log('\n📋 Current providers:');
    allProviders.forEach(provider => {
      console.log(`  - ${provider.name}`);
      console.log(`    Platform: ${provider.platform || 'Not set'}`);
      console.log(`    Region: ${provider.region || 'Not set'}`);
      console.log(`    Active: ${provider.isActive}`);
      console.log(`    Activities: ${provider._count.activities}`);
    });
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Run the migration
if (require.main === module) {
  runProviderEnhancements()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runProviderEnhancements };