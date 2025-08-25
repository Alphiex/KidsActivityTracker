#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function findYogaActivities() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    // Find Yoga activities with instructors
    const yogaActivities = await prisma.activity.findMany({
      where: {
        OR: [
          { name: { contains: 'Yoga' } },
          { instructor: { not: null } }
        ],
        providerId: '7023bd59-82ea-4a0d-92fc-99f9ef92f60e'
      },
      select: { 
        name: true, 
        courseId: true, 
        instructor: true,
        registrationUrl: true 
      },
      take: 10
    });
    
    console.log('Activities with potential instructors:\n');
    yogaActivities.forEach(act => {
      if (act.instructor && act.instructor.length < 50) {
        console.log(`✅ ${act.name} (${act.courseId})`);
        console.log(`   Instructor: ${act.instructor}`);
        console.log(`   URL: ${act.registrationUrl}`);
        console.log('');
      }
    });
    
    // Also check activities that currently have bad instructor data
    const badInstructors = await prisma.activity.findMany({
      where: {
        instructor: {
          contains: 'instructors'
        }
      },
      select: { name: true, courseId: true, instructor: true },
      take: 5
    });
    
    console.log('\nActivities with incorrect instructor data:');
    badInstructors.forEach(act => {
      console.log(`❌ ${act.name} (${act.courseId})`);
      console.log(`   Bad data: "${act.instructor?.substring(0, 80)}..."`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findYogaActivities();