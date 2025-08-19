const { PrismaClient } = require('./generated/prisma');
const fs = require('fs');
const path = require('path');

async function updateSchema() {
  console.log('🔄 Updating production database schema...');
  
  // Load production environment
  require('dotenv').config({ path: '.env.production' });
  
  const prisma = new PrismaClient();
  
  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'create-all-tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolons but handle DO blocks specially
    const statements = [];
    let currentStatement = '';
    let inDoBlock = false;
    
    const lines = sqlContent.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if we're entering or exiting a DO block
      if (trimmedLine.startsWith('DO $$')) {
        inDoBlock = true;
      }
      
      currentStatement += line + '\n';
      
      // Check if statement is complete
      if (trimmedLine.endsWith(';')) {
        if (inDoBlock && trimmedLine.includes('$$;')) {
          // End of DO block
          inDoBlock = false;
          statements.push(currentStatement.trim());
          currentStatement = '';
        } else if (!inDoBlock) {
          // Regular statement
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
    }
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement || statement.startsWith('--')) continue;
      
      try {
        console.log(`\n📋 Executing statement ${i + 1}/${statements.length}...`);
        
        // Show first 100 chars of the statement
        const preview = statement.substring(0, 100).replace(/\n/g, ' ');
        console.log(`   ${preview}${statement.length > 100 ? '...' : ''}`);
        
        await prisma.$executeRawUnsafe(statement);
        successCount++;
        console.log('   ✅ Success');
      } catch (error) {
        errorCount++;
        if (error.code === 'P2010' && error.meta?.code === '42P07') {
          // Table/column already exists - that's okay
          console.log('   ⚠️  Already exists (skipping)');
        } else {
          console.error('   ❌ Error:', error.message);
        }
      }
    }
    
    console.log(`\n📊 Schema Update Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    // Verify tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Activity', 'ActivitySession', 'ActivityPrerequisite')
      ORDER BY table_name
    `;
    
    console.log('\n📊 Table Verification:');
    tables.forEach(t => console.log(`   ✅ Table ${t.table_name} exists`));
    
    // Count enhanced activities
    const enhancedCount = await prisma.activity.count({
      where: {
        OR: [
          { instructor: { not: null } },
          { fullDescription: { not: null } },
          { dates: { not: null } }
        ]
      }
    });
    
    console.log(`\n📈 Enhanced activities in database: ${enhancedCount}`);
    
  } catch (error) {
    console.error('❌ Schema update failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateSchema();