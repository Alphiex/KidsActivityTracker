const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function analyzeLocationActivities() {
  try {
    console.log('Analyzing location activities...\n');

    // 1. Get all locations with active activities count
    const locationsWithActivities = await prisma.location.findMany({
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
              where: {
                isActive: true
              }
            }
          }
        }
      },
      orderBy: {
        activities: {
          _count: 'desc'
        }
      }
    });

    console.log('=== LOCATIONS WITH ACTIVE ACTIVITIES ===\n');
    console.log(`Total locations with active activities: ${locationsWithActivities.length}\n`);

    // Display location details with counts
    locationsWithActivities.forEach((location, index) => {
      console.log(`${index + 1}. ${location.name}`);
      console.log(`   Address: ${location.address}`);
      console.log(`   City: ${location.city}, ${location.state} ${location.zipCode}`);
      console.log(`   Active Activities: ${location._count.activities}`);
      console.log('');
    });

    // 2. Calculate distribution statistics
    const totalActiveActivities = locationsWithActivities.reduce(
      (sum, loc) => sum + loc._count.activities, 
      0
    );

    console.log('\n=== DISTRIBUTION ANALYSIS ===\n');
    console.log(`Total active activities across all locations: ${totalActiveActivities}`);

    // Check concentration in top locations
    if (locationsWithActivities.length > 0) {
      const top2Count = locationsWithActivities
        .slice(0, 2)
        .reduce((sum, loc) => sum + loc._count.activities, 0);
      
      const top2Percentage = (top2Count / totalActiveActivities * 100).toFixed(1);
      
      console.log(`\nTop 2 locations have ${top2Count} activities (${top2Percentage}% of total)`);
      
      // Show percentage distribution for all locations
      console.log('\n=== PERCENTAGE DISTRIBUTION ===\n');
      locationsWithActivities.forEach((location, index) => {
        const percentage = (location._count.activities / totalActiveActivities * 100).toFixed(1);
        console.log(`${index + 1}. ${location.name}: ${location._count.activities} activities (${percentage}%)`);
      });
    }

    // 3. Get all locations (including those without active activities)
    const allLocations = await prisma.location.findMany({
      include: {
        _count: {
          select: {
            activities: true
          }
        }
      }
    });

    console.log(`\n=== ALL LOCATIONS SUMMARY ===\n`);
    console.log(`Total locations in database: ${allLocations.length}`);
    console.log(`Locations with active activities: ${locationsWithActivities.length}`);
    console.log(`Locations without active activities: ${allLocations.length - locationsWithActivities.length}`);

    // 4. Sample of active activities by location
    console.log('\n=== SAMPLE ACTIVE ACTIVITIES BY LOCATION ===\n');
    
    for (let i = 0; i < Math.min(3, locationsWithActivities.length); i++) {
      const location = locationsWithActivities[i];
      const activities = await prisma.activity.findMany({
        where: {
          locationId: location.id,
          isActive: true
        },
        take: 5,
        select: {
          name: true,
          category: true,
          ageMin: true,
          ageMax: true
        }
      });

      console.log(`\n${location.name}:`);
      activities.forEach(activity => {
        const ageRange = activity.ageMin && activity.ageMax ? `Ages ${activity.ageMin}-${activity.ageMax}` : 'All ages';
        console.log(`  - ${activity.name} (${activity.category}) - ${ageRange}`);
      });
    }

  } catch (error) {
    console.error('Error analyzing location activities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeLocationActivities();