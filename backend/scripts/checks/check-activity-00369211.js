#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function checkActivity() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    const activity = await prisma.activity.findFirst({
      where: {
        courseId: '00369211'
      }
    });
    
    if (activity) {
      console.log('Activity 00369211:');
      console.log('- Name:', activity.name);
      console.log('- Cost: $' + activity.cost);
      console.log('- Cost includes tax:', activity.costIncludesTax);
      console.log('- Last updated:', activity.updatedAt);
    } else {
      console.log('Activity 00369211 not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivity();