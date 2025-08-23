require('dotenv').config({ path: require('path').join(__dirname, '../.env.development') });
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function checkLocations() {
  try {
    console.log('=== Location Investigation ===\n');

    // 1. Count distinct locationName values in Activity table
    const distinctLocationNames = await prisma.activity.findMany({
      where: { 
        locationName: { not: null },
        isActive: true 
      },
      distinct: ['locationName'],
      select: { locationName: true }
    });
    
    console.log(`1. Distinct locationName values in Activity table: ${distinctLocationNames.length}`);
    console.log('   Sample location names:');
    distinctLocationNames.slice(0, 10).forEach(loc => {
      console.log(`   - ${loc.locationName}`);
    });

    // 2. Count records in Location table
    const locationCount = await prisma.location.count();
    console.log(`\n2. Total records in Location table: ${locationCount}`);
    
    // Get sample locations
    const sampleLocations = await prisma.location.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log('   Sample locations:');
    sampleLocations.forEach(loc => {
      console.log(`   - ${loc.name} (${loc.address || 'no address'})`);
    });

    // 3. Activities with null locationId but valid locationName
    const orphanedActivities = await prisma.activity.count({
      where: {
        locationId: null,
        locationName: { not: null },
        isActive: true
      }
    });
    console.log(`\n3. Activities with null locationId but valid locationName: ${orphanedActivities}`);

    // Get sample orphaned activities
    const sampleOrphaned = await prisma.activity.findMany({
      where: {
        locationId: null,
        locationName: { not: null },
        isActive: true
      },
      take: 5,
      select: {
        id: true,
        name: true,
        locationName: true,
        providerId: true
      }
    });
    if (sampleOrphaned.length > 0) {
      console.log('   Sample orphaned activities:');
      sampleOrphaned.forEach(act => {
        console.log(`   - "${act.name}" at "${act.locationName}"`);
      });
    }

    // 4. Check for activities with locationId that doesn't exist
    const activitiesWithLocation = await prisma.activity.findMany({
      where: {
        locationId: { not: null },
        isActive: true
      },
      include: {
        location: true
      },
      take: 100
    });

    const brokenLinks = activitiesWithLocation.filter(act => !act.location);
    console.log(`\n4. Activities with locationId that doesn't exist in Location table: ${brokenLinks.length}`);

    // 5. Count activities by location
    const activityCountByLocation = await prisma.activity.groupBy({
      by: ['locationId'],
      where: {
        locationId: { not: null },
        isActive: true
      },
      _count: true,
      orderBy: {
        _count: {
          locationId: 'desc'
        }
      },
      take: 10
    });

    console.log('\n5. Top 10 locations by activity count:');
    for (const group of activityCountByLocation) {
      if (group.locationId) {
        const location = await prisma.location.findUnique({
          where: { id: group.locationId }
        });
        console.log(`   - ${location?.name || 'Unknown'}: ${group._count} activities`);
      }
    }

    // 6. Check for duplicate location names
    const locationNameGroups = await prisma.location.groupBy({
      by: ['name'],
      _count: true,
      having: {
        name: {
          _count: {
            gt: 1
          }
        }
      }
    });

    console.log(`\n6. Duplicate location names in Location table: ${locationNameGroups.length}`);
    if (locationNameGroups.length > 0) {
      console.log('   Duplicates:');
      locationNameGroups.forEach(group => {
        console.log(`   - "${group.name}": ${group._count} records`);
      });
    }

    // 7. Summary statistics
    const totalActiveActivities = await prisma.activity.count({
      where: { isActive: true }
    });
    const activitiesWithLocationId = await prisma.activity.count({
      where: {
        locationId: { not: null },
        isActive: true
      }
    });

    // 8. Check how many unique locations are actually used by activities
    const uniqueLocationIdsInActivities = await prisma.activity.findMany({
      where: {
        locationId: { not: null },
        isActive: true
      },
      distinct: ['locationId'],
      select: { locationId: true }
    });

    console.log('\n=== Summary ===');
    console.log(`Total active activities: ${totalActiveActivities}`);
    console.log(`Activities with locationId: ${activitiesWithLocationId} (${((activitiesWithLocationId/totalActiveActivities)*100).toFixed(1)}%)`);
    console.log(`Activities without locationId: ${totalActiveActivities - activitiesWithLocationId} (${(((totalActiveActivities - activitiesWithLocationId)/totalActiveActivities)*100).toFixed(1)}%)`);
    console.log(`\nLocation table stats:`);
    console.log(`Total locations in DB: ${locationCount}`);
    console.log(`Unique locations referenced by activities: ${uniqueLocationIdsInActivities.length}`);
    console.log(`Unused locations: ${locationCount - uniqueLocationIdsInActivities.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocations();