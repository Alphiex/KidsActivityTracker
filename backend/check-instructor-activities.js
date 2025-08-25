#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function checkInstructorActivities() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    // Check activity 00392687
    const activity1 = await prisma.activity.findFirst({ 
      where: { courseId: '00392687' },
      select: { name: true, registrationUrl: true, instructor: true }
    });
    
    if (activity1) {
      console.log('Activity 00392687:');
      console.log('Name:', activity1.name);
      console.log('Current instructor:', activity1.instructor || '(none)');
      console.log('URL:', activity1.registrationUrl);
      console.log('');
    }
    
    // Check activities that have "Yin" in the name (from screenshot)
    const yogaActivities = await prisma.activity.findMany({
      where: {
        name: {
          contains: 'Yoga Yin'
        }
      },
      select: { name: true, courseId: true, instructor: true, registrationUrl: true },
      take: 5
    });
    
    console.log('Yoga Yin activities:');
    yogaActivities.forEach(act => {
      console.log(`- ${act.name} (${act.courseId})`);
      console.log(`  Instructor: ${act.instructor || '(none)'}`);
      console.log(`  URL: ${act.registrationUrl?.substring(0, 80)}...`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructorActivities();