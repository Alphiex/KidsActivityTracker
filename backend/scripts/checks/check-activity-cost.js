const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkActivity() {
  try {
    const activity = await prisma.activity.findFirst({
      where: { externalId: '00369211' },
      include: {
        provider: true,
        location: true,
        sessions: true,
        prerequisitesList: true
      }
    });
    
    if (activity) {
      console.log('Activity found:');
      console.log('External ID:', activity.externalId);
      console.log('Name:', activity.name);
      console.log('Cost:', activity.cost);
      console.log('Provider:', activity.provider?.name);
      console.log('Location:', activity.location?.name);
      console.log('Age Range:', activity.ageMin, '-', activity.ageMax);
      console.log('Last Updated:', activity.updatedAt);
      
      console.log('\nDetailed Information:');
      console.log('  Registration Status:', activity.registrationStatus);
      console.log('  Registration URL:', activity.registrationUrl);
      console.log('  Direct Registration URL:', activity.directRegistrationUrl);
      console.log('  Prerequisites:', activity.prerequisites);
      console.log('  What to Bring:', activity.whatToBring);
      console.log('  Full Description:', activity.fullDescription ? activity.fullDescription.substring(0, 100) + '...' : 'N/A');
      console.log('  Sessions:', activity.sessions ? activity.sessions.length : 0);
      console.log('  Prerequisites List:', activity.prerequisitesList ? activity.prerequisitesList.length : 0);
    } else {
      console.log('Activity 00369211 not found in database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivity();