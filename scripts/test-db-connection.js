const { PrismaClient } = require('../generated/prisma');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    
    // Test basic query
    const activityCount = await prisma.activity.count();
    console.log(`Total activities in database: ${activityCount}`);
    
    // Test with isActive filter
    const activeCount = await prisma.activity.count({
      where: { isActive: true }
    });
    console.log(`Active activities: ${activeCount}`);
    
    // Get a sample activity
    const sampleActivity = await prisma.activity.findFirst({
      where: { isActive: true },
      include: {
        location: true
      }
    });
    
    if (sampleActivity) {
      console.log('\nSample activity:');
      console.log(`- Name: ${sampleActivity.name}`);
      console.log(`- Location ID: ${sampleActivity.locationId}`);
      console.log(`- Location Name: ${sampleActivity.locationName}`);
      console.log(`- Location Object:`, sampleActivity.location);
    }
    
    console.log('\nDatabase connection successful!');
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();