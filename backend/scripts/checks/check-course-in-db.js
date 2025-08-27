#!/usr/bin/env node

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function checkCourseInDb() {
  try {
    // Find the activity by course ID
    const activity = await prisma.activity.findFirst({
      where: {
        OR: [
          { courseId: '00371053' },
          { externalId: '8df45f73-8d06-4dea-ad95-71ed1b744f7c' }
        ]
      },
      include: {
        provider: true,
        location: true
      }
    });
    
    if (activity) {
      console.log('Found activity in database:');
      console.log(JSON.stringify({
        id: activity.id,
        name: activity.name,
        courseId: activity.courseId,
        externalId: activity.externalId,
        registrationStatus: activity.registrationStatus,
        spotsAvailable: activity.spotsAvailable,
        schedule: activity.schedule,
        dateStart: activity.dateStart,
        dateEnd: activity.dateEnd,
        fullDescription: activity.fullDescription?.substring(0, 100),
        instructor: activity.instructor,
        cost: activity.cost,
        sessionCount: activity.sessionCount,
        locationName: activity.locationName
      }, null, 2));
    } else {
      console.log('Activity not found in database');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCourseInDb();