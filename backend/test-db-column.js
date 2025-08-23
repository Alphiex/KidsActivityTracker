require('dotenv').config({ path: '.env.production' });

const { PrismaClient } = require('./generated/prisma');

async function testColumn() {
  const prisma = new PrismaClient();
  
  try {
    // Test raw query to check if column exists
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Activity' 
      AND column_name = 'dates'
    `;
    
    console.log('Column exists:', result.length > 0);
    console.log('Result:', result);
    
    // Try to query an activity
    const activity = await prisma.activity.findFirst({
      select: {
        id: true,
        name: true,
        dates: true
      }
    });
    
    console.log('Sample activity:', activity);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testColumn();