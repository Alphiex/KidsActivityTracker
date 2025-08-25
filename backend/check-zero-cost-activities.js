#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function checkZeroCostActivities() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    // Get activities with zero cost
    const zeroCostActivities = await prisma.activity.findMany({
      where: {
        cost: 0,
        providerId: '7023bd59-82ea-4a0d-92fc-99f9ef92f60e' // NVRC provider
      },
      select: {
        name: true,
        courseId: true,
        registrationUrl: true,
        lastSeenAt: true
      },
      take: 20
    });
    
    const totalZeroCost = await prisma.activity.count({
      where: {
        cost: 0,
        providerId: '7023bd59-82ea-4a0d-92fc-99f9ef92f60e'
      }
    });
    
    console.log(`\n📊 Activities with $0 cost from NVRC:\n`);
    console.log(`Total: ${totalZeroCost} activities\n`);
    
    console.log('Sample activities with zero cost:');
    zeroCostActivities.forEach(activity => {
      console.log(`- ${activity.name} (${activity.courseId})`);
      if (activity.registrationUrl) {
        console.log(`  URL: ${activity.registrationUrl.substring(0, 80)}...`);
      } else {
        console.log(`  ⚠️  No registration URL`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkZeroCostActivities();