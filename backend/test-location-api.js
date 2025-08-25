#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function testLocationAPI() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    console.log('🔍 TESTING LOCATION API QUERY\n');
    
    // 1. Current API query (returns ALL locations)
    console.log('1. CURRENT API QUERY (returns ALL locations):');
    const currentAPIResult = await prisma.location.findMany({
      orderBy: { name: 'asc' }
    });
    console.log(`   Returns: ${currentAPIResult.length} locations`);
    console.log(`   First 5: ${currentAPIResult.slice(0, 5).map(l => l.name).join(', ')}`);
    
    // 2. Better query - only locations with active activities
    console.log('\n2. IMPROVED QUERY (only locations with active activities):');
    const improvedResult = await prisma.location.findMany({
      where: {
        activities: {
          some: {
            isActive: true
          }
        }
      },
      include: {
        _count: {
          select: { 
            activities: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    console.log(`   Returns: ${improvedResult.length} locations`);
    console.log(`   With activity counts:`);
    improvedResult.slice(0, 5).forEach(loc => {
      console.log(`     - ${loc.name}: ${loc._count.activities} activities`);
    });
    
    // 3. Check why app might only show 2
    console.log('\n3. DEBUGGING: Why app shows only 2 locations?');
    
    // Check if there's a limit in the activities query
    const activitiesWithLimit = await prisma.activity.findMany({
      where: { isActive: true },
      take: 50, // Default limit?
      select: {
        locationId: true,
        locationName: true,
        location: {
          select: { name: true }
        }
      },
      distinct: ['locationId']
    });
    
    const uniqueLocationIds = new Set(activitiesWithLimit.filter(a => a.locationId).map(a => a.locationId));
    console.log(`   With 50-activity limit: ${uniqueLocationIds.size} unique locations`);
    
    // Check activities without locations
    const noLocation = await prisma.activity.count({
      where: {
        isActive: true,
        locationId: null
      }
    });
    console.log(`   Activities without locationId: ${noLocation}`);
    
    // Get location names from activities
    const activityLocationNames = await prisma.activity.findMany({
      where: {
        isActive: true,
        locationName: { not: null }
      },
      select: { locationName: true },
      distinct: ['locationName']
    });
    
    const uniqueLocationNames = new Set(activityLocationNames.map(a => a.locationName));
    console.log(`   Unique locationNames in activities: ${uniqueLocationNames.size}`);
    console.log(`   First 5 locationNames: ${Array.from(uniqueLocationNames).slice(0, 5).join(', ')}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLocationAPI();