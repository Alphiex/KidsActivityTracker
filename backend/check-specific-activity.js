const { PrismaClient } = require('./generated/prisma');

async function checkActivity() {
  require('dotenv').config({ path: '.env.production' });
  const prisma = new PrismaClient();
  
  const courseId = '00371503';
  const externalId = '8df45f73-8d06-4dea-ad95-71ed1b744f7c';
  
  try {
    // Find by courseId or externalId
    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { courseId: courseId },
          { externalId: externalId },
          { externalId: courseId }
        ]
      },
      include: {
        sessions: true,
        prerequisitesList: true
      }
    });
    
    if (activities.length === 0) {
      console.log(`❌ No activity found with courseId ${courseId} or externalId ${externalId}`);
      return;
    }
    
    console.log(`Found ${activities.length} matching activities:\n`);
    
    activities.forEach((activity, index) => {
      console.log(`\n======= Activity ${index + 1} =======`);
      console.log(`ID: ${activity.id}`);
      console.log(`Name: ${activity.name}`);
      console.log(`External ID: ${activity.externalId}`);
      console.log(`Course ID: ${activity.courseId}`);
      console.log(`\n📅 Dates & Times:`);
      console.log(`  Dates (string): ${activity.dates}`);
      console.log(`  Start Date: ${activity.startDate}`);
      console.log(`  End Date: ${activity.endDate}`);
      console.log(`  Start Time: ${activity.startTime}`);
      console.log(`  End Time: ${activity.endTime}`);
      console.log(`  Date Range: ${activity.dateStart} - ${activity.dateEnd}`);
      console.log(`\n📋 Registration:`);
      console.log(`  Status: ${activity.registrationStatus}`);
      console.log(`  Button Text: ${activity.registrationButtonText}`);
      console.log(`  Spots Available: ${activity.spotsAvailable}`);
      console.log(`  Total Spots: ${activity.totalSpots}`);
      console.log(`  Registration End Date: ${activity.registrationEndDate}`);
      console.log(`  Registration End Time: ${activity.registrationEndTime}`);
      console.log(`\n📝 Description:`);
      console.log(`  Short: ${activity.description?.substring(0, 100)}...`);
      console.log(`  Full Description: ${activity.fullDescription?.substring(0, 200)}...`);
      console.log(`  Course Details: ${activity.courseDetails?.substring(0, 100)}...`);
      console.log(`\n💰 Cost:`);
      console.log(`  Amount: $${activity.cost}`);
      console.log(`  Includes Tax: ${activity.costIncludesTax}`);
      console.log(`  Tax Amount: $${activity.taxAmount || 0}`);
      console.log(`\n👤 Other Details:`);
      console.log(`  Instructor: ${activity.instructor}`);
      console.log(`  Location: ${activity.locationName}`);
      console.log(`  Full Address: ${activity.fullAddress}`);
      console.log(`  What to Bring: ${activity.whatToBring?.substring(0, 100)}...`);
      console.log(`  Prerequisites: ${activity.prerequisites?.substring(0, 100)}...`);
      console.log(`\n🔗 URLs:`);
      console.log(`  Registration URL: ${activity.registrationUrl}`);
      console.log(`  Direct Registration URL: ${activity.directRegistrationUrl}`);
      console.log(`  Detail URL: ${activity.detailUrl}`);
      console.log(`\n📊 Sessions: ${activity.sessions.length}`);
      console.log(`  Has Multiple Sessions: ${activity.hasMultipleSessions}`);
      console.log(`  Session Count: ${activity.sessionCount}`);
      console.log(`\n⏰ Last Updated: ${activity.updatedAt}`);
      console.log(`  Last Seen: ${activity.lastSeenAt}`);
      
      if (activity.rawData) {
        console.log(`\n🔍 Raw Data Available: Yes`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivity();