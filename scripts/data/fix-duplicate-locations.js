#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function fixDuplicateLocations() {
  try {
    console.log('🔍 Finding duplicate locations...\n');
    
    // Find all locations grouped by name
    const locations = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count, array_agg(id) as ids, array_agg(address) as addresses
      FROM "Location"
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `;
    
    console.log(`Found ${locations.length} location names with duplicates\n`);
    
    for (const loc of locations) {
      console.log(`\n📍 Processing: ${loc.name}`);
      console.log(`   Duplicates: ${loc.count}`);
      
      // Get all location records for this name
      const duplicates = await prisma.location.findMany({
        where: { name: loc.name },
        include: {
          _count: {
            select: { activities: true }
          }
        },
        orderBy: [
          { address: 'desc' }, // Prefer locations with addresses
          { createdAt: 'asc' } // Then oldest first
        ]
      });
      
      // Find the best location to keep (one with address or most activities)
      let primaryLocation = duplicates[0];
      for (const dup of duplicates) {
        // Prefer location with a real address
        if (dup.address && dup.address.length > 5 && !primaryLocation.address) {
          primaryLocation = dup;
        }
        // Or prefer location with most activities
        else if (dup._count.activities > primaryLocation._count.activities) {
          primaryLocation = dup;
        }
      }
      
      console.log(`   Primary location: ${primaryLocation.id}`);
      console.log(`   Address: ${primaryLocation.address || '(empty)'}`);
      console.log(`   Activities: ${primaryLocation._count.activities}`);
      
      // Update all activities to use the primary location
      const otherLocationIds = duplicates
        .filter(d => d.id !== primaryLocation.id)
        .map(d => d.id);
      
      if (otherLocationIds.length > 0) {
        const updateResult = await prisma.activity.updateMany({
          where: {
            locationId: { in: otherLocationIds }
          },
          data: {
            locationId: primaryLocation.id
          }
        });
        
        console.log(`   ✅ Updated ${updateResult.count} activities to use primary location`);
        
        // Delete the duplicate locations
        const deleteResult = await prisma.location.deleteMany({
          where: {
            id: { in: otherLocationIds }
          }
        });
        
        console.log(`   🗑️  Deleted ${deleteResult.count} duplicate locations`);
      }
    }
    
    // Also fix locations with extremely long names (likely data errors)
    console.log('\n\n🔧 Fixing locations with invalid names...');
    
    const invalidLocations = await prisma.location.findMany({
      where: {
        OR: [
          { name: { contains: 'These camps are designed' } },
          { name: { contains: 'This program is designed' } },
          { name: { contains: 'Join us for' } }
        ]
      }
    });
    
    console.log(`Found ${invalidLocations.length} locations with invalid names`);
    
    for (const loc of invalidLocations) {
      console.log(`\n❌ Invalid location: ${loc.name.substring(0, 50)}...`);
      
      // Try to extract a real location name from the text
      let realLocationName = 'Community Centre'; // Default
      
      // Common patterns in NVRC data
      if (loc.name.includes('Delbrook')) realLocationName = 'Delbrook Community Recreation Centre';
      else if (loc.name.includes('Ron Andrews')) realLocationName = 'Ron Andrews Community Recreation Centre';
      else if (loc.name.includes('Parkgate')) realLocationName = 'Parkgate Community Centre';
      else if (loc.name.includes('Karen Magnussen')) realLocationName = 'Karen Magnussen Community Recreation Centre';
      
      // Find or create the correct location
      const correctLocation = await prisma.location.upsert({
        where: {
          name_address: {
            name: realLocationName,
            address: loc.address || ''
          }
        },
        update: {},
        create: {
          name: realLocationName,
          address: loc.address || '',
          city: loc.city,
          province: loc.province,
          postalCode: loc.postalCode,
          latitude: loc.latitude,
          longitude: loc.longitude,
          facility: loc.facility
        }
      });
      
      // Update activities
      const updateResult = await prisma.activity.updateMany({
        where: { locationId: loc.id },
        data: { locationId: correctLocation.id }
      });
      
      console.log(`   ✅ Moved ${updateResult.count} activities to: ${realLocationName}`);
      
      // Delete the invalid location
      await prisma.location.delete({
        where: { id: loc.id }
      });
      
      console.log(`   🗑️  Deleted invalid location`);
    }
    
    // Final summary
    console.log('\n\n📊 Final Summary:');
    
    const finalLocationCount = await prisma.location.count();
    const locationsWithActivities = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT l.id) as count
      FROM "Location" l
      INNER JOIN "Activity" a ON a."locationId" = l.id
    `;
    
    console.log(`✅ Total locations: ${finalLocationCount}`);
    console.log(`✅ Locations with activities: ${locationsWithActivities[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run with DATABASE_URL
fixDuplicateLocations();