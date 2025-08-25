#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function checkRecentUpdates() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    // Get recently updated activities
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const recentlyUpdated = await prisma.activity.findMany({
      where: {
        updatedAt: {
          gte: fiveMinutesAgo
        },
        cost: {
          gt: 0
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        name: true,
        courseId: true,
        cost: true,
        updatedAt: true
      },
      take: 10
    });
    
    console.log(`\n📊 Activities updated in the last 5 minutes with cost > 0:\n`);
    
    if (recentlyUpdated.length === 0) {
      console.log('No activities updated in the last 5 minutes');
    } else {
      recentlyUpdated.forEach(activity => {
        const timeSince = Math.floor((Date.now() - activity.updatedAt.getTime()) / 1000);
        console.log(`- ${activity.name} (${activity.courseId}): $${activity.cost} - Updated ${timeSince}s ago`);
      });
    }
    
    // Also check total activities with cost > 0
    const totalWithCost = await prisma.activity.count({
      where: {
        cost: {
          gt: 0
        }
      }
    });
    
    const totalActivities = await prisma.activity.count();
    
    console.log(`\n📈 Statistics:`);
    console.log(`Total activities: ${totalActivities}`);
    console.log(`Activities with cost > 0: ${totalWithCost} (${((totalWithCost/totalActivities) * 100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentUpdates();