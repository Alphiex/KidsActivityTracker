require('dotenv').config({ path: '.env.production' });

const { PrismaClient } = require('../generated/prisma');

async function checkTables() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking database tables...\n');
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('📊 Tables in database:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    console.log(`\nTotal: ${tables.length} tables`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables().catch(console.error);