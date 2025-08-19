const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function testActivityUpdate() {
  console.log('🧪 Testing activity update with sessions...');
  
  try {
    // Get a sample activity
    const activity = await prisma.activity.findFirst({
      where: { 
        isActive: true,
        category: 'School Age'
      }
    });
    
    if (!activity) {
      console.log('No active swimming activity found');
      return;
    }
    
    console.log(`\n📄 Testing with activity: ${activity.name} (${activity.id})`);
    
    // Add some test sessions
    const sessions = await prisma.activitySession.createMany({
      data: [
        {
          activityId: activity.id,
          sessionNumber: 1,
          date: 'January 8 - March 12',
          startTime: '4:30 PM',
          endTime: '5:15 PM',
          location: 'Pool A',
          instructor: 'John Smith'
        },
        {
          activityId: activity.id,
          sessionNumber: 2,
          date: 'March 19 - May 21',
          startTime: '4:30 PM',
          endTime: '5:15 PM',
          location: 'Pool A',
          instructor: 'Jane Doe'
        }
      ]
    });
    
    // Update activity flags
    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        hasMultipleSessions: true,
        sessionCount: 2
      }
    });
    
    console.log('✅ Successfully added test sessions');
    
    // Verify
    const updatedActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
      include: {
        sessions: true
      }
    });
    
    console.log(`\n📊 Updated activity has ${updatedActivity.sessions.length} sessions`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testActivityUpdate();