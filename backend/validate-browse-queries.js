#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');

async function validateBrowseQueries() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    console.log('🔍 VALIDATING BROWSE QUERIES FROM HOME PAGE\n');
    console.log('='.repeat(60));
    
    // 1. LOCATIONS
    console.log('\n📍 1. LOCATIONS BROWSE');
    console.log('-'.repeat(40));
    
    // Check total locations
    const totalLocations = await prisma.location.count();
    console.log(`Total locations in database: ${totalLocations}`);
    
    // Get locations with active activities
    const locationsWithActivities = await prisma.location.findMany({
      where: {
        activities: {
          some: {
            isActive: true
          }
        }
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { activities: true }
        }
      },
      orderBy: {
        activities: {
          _count: 'desc'
        }
      }
    });
    
    console.log(`Locations with active activities: ${locationsWithActivities.length}`);
    console.log('\nTop 10 locations:');
    locationsWithActivities.slice(0, 10).forEach(loc => {
      console.log(`  - ${loc.name}: ${loc._count.activities} activities`);
    });
    
    // 2. CATEGORIES
    console.log('\n\n🏷️  2. CATEGORIES BROWSE');
    console.log('-'.repeat(40));
    
    const categories = await prisma.activity.groupBy({
      by: ['category'],
      where: {
        isActive: true,
        NOT: {
          category: null
        }
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });
    
    console.log(`Total categories: ${categories.length}`);
    console.log('\nCategories with counts:');
    categories.forEach(cat => {
      console.log(`  - ${cat.category || '(null)'}: ${cat._count._all} activities`);
    });
    
    // 3. AGE GROUPS
    console.log('\n\n👶 3. AGE GROUPS BROWSE');
    console.log('-'.repeat(40));
    
    const ageGroups = [
      { name: '0-2 years', min: 0, max: 2 },
      { name: '3-5 years', min: 3, max: 5 },
      { name: '6-8 years', min: 6, max: 8 },
      { name: '9-12 years', min: 9, max: 12 },
      { name: '13+ years', min: 13, max: 99 }
    ];
    
    console.log('Age group activity counts:');
    for (const group of ageGroups) {
      const count = await prisma.activity.count({
        where: {
          isActive: true,
          ageMin: { lte: group.max },
          ageMax: { gte: group.min }
        }
      });
      console.log(`  - ${group.name}: ${count} activities`);
    }
    
    // 4. ACTIVITY TYPES (subcategories)
    console.log('\n\n🎯 4. ACTIVITY TYPES BROWSE');
    console.log('-'.repeat(40));
    
    const activityTypes = await prisma.activity.groupBy({
      by: ['subcategory'],
      where: {
        isActive: true,
        NOT: {
          subcategory: null
        }
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      },
      take: 20
    });
    
    console.log(`Total activity types: ${activityTypes.length}`);
    console.log('\nTop activity types:');
    activityTypes.forEach(type => {
      console.log(`  - ${type.subcategory}: ${type._count._all} activities`);
    });
    
    // CHECK API ENDPOINTS
    console.log('\n\n🌐 API ENDPOINT TESTS');
    console.log('-'.repeat(40));
    
    // Test locations endpoint
    console.log('\nTesting /api/locations endpoint simulation...');
    const apiLocations = await prisma.location.findMany({
      where: {
        activities: {
          some: {
            isActive: true
          }
        }
      },
      include: {
        _count: {
          select: { activities: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`API would return: ${apiLocations.length} locations`);
    if (apiLocations.length <= 2) {
      console.log('⚠️  WARNING: Only 2 or fewer locations returned!');
      console.log('First 2 locations:', apiLocations.map(l => l.name));
    }
    
    // Check for any issues
    console.log('\n\n🔍 POTENTIAL ISSUES');
    console.log('-'.repeat(40));
    
    // Check inactive activities
    const inactiveCount = await prisma.activity.count({
      where: { isActive: false }
    });
    console.log(`Inactive activities: ${inactiveCount}`);
    
    // Check activities without locations
    const noLocationCount = await prisma.activity.count({
      where: {
        locationId: null,
        isActive: true
      }
    });
    console.log(`Active activities without location: ${noLocationCount}`);
    
    // Check duplicate locations
    const duplicateLocations = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count 
      FROM "Location" 
      GROUP BY name 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `;
    console.log(`\nDuplicate location names: ${duplicateLocations.length}`);
    if (duplicateLocations.length > 0) {
      console.log('Top duplicates:');
      duplicateLocations.forEach(dup => {
        console.log(`  - "${dup.name}": ${dup.count} times`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateBrowseQueries();