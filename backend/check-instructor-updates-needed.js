#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function checkInstructorUpdatesNeeded() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    // Count activities with bad instructor data (contains description text)
    const badInstructors = await prisma.activity.count({
      where: {
        instructor: {
          contains: 'instructors'
        }
      }
    });
    
    // Get sample of bad instructor data
    const samples = await prisma.activity.findMany({
      where: {
        instructor: {
          contains: 'instructors'
        }
      },
      select: {
        name: true,
        courseId: true,
        instructor: true
      },
      take: 3
    });
    
    console.log('📊 Instructor Data Status:\n');
    console.log(`❌ Activities with incorrect instructor data: ${badInstructors}`);
    console.log('\nSamples of incorrect data:');
    samples.forEach(s => {
      console.log(`- ${s.name} (${s.courseId})`);
      console.log(`  Bad: "${s.instructor?.substring(0, 60)}..."`);
    });
    
    // Count activities with proper instructor names
    const goodInstructors = await prisma.activity.count({
      where: {
        instructor: {
          not: null
        },
        NOT: {
          instructor: {
            contains: 'instructors'
          }
        }
      }
    });
    
    console.log(`\n✅ Activities with proper instructor names: ${goodInstructors}`);
    
    // Get total activities
    const total = await prisma.activity.count();
    const withInstructor = await prisma.activity.count({
      where: {
        instructor: {
          not: null
        }
      }
    });
    
    console.log(`\n📈 Overall Statistics:`);
    console.log(`Total activities: ${total}`);
    console.log(`Activities with instructor field: ${withInstructor} (${((withInstructor/total)*100).toFixed(1)}%)`);
    console.log(`Activities needing instructor fix: ${badInstructors}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructorUpdatesNeeded();