require('dotenv').config({ path: require('path').join(__dirname, '../.env.development') });
const { PrismaClient } = require('../generated/prisma');
const axios = require('axios');

const prisma = new PrismaClient();

async function debugLocationAPI() {
  try {
    console.log('=== Location API Debug ===\n');

    // 1. First check what the database query returns
    console.log('1. Direct database query (same as API):');
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            activities: true
          }
        }
      }
    });
    
    console.log(`   Total locations: ${locations.length}`);
    
    // 2. Check for locations with activity counts
    const locationsWithActivities = locations.filter(loc => loc._count.activities > 0);
    console.log(`   Locations with activities: ${locationsWithActivities.length}`);
    
    console.log('\n2. Locations with activity counts:');
    locationsWithActivities.forEach(loc => {
      console.log(`   - ${loc.name}: ${loc._count.activities} activities`);
    });
    
    // 3. Check for problematic location names
    console.log('\n3. Checking for problematic location names:');
    const problemLocations = locations.filter(loc => {
      return loc.name.includes('\n') || 
             loc.name.includes('\r') || 
             loc.name.includes('\t') ||
             loc.name.trim() !== loc.name ||
             loc.name.length > 100;
    });
    
    if (problemLocations.length > 0) {
      console.log(`   Found ${problemLocations.length} locations with problematic names:`);
      problemLocations.forEach(loc => {
        console.log(`   - "${loc.name}" (length: ${loc.name.length})`);
      });
    } else {
      console.log('   No problematic location names found.');
    }
    
    // 4. Test the API endpoint if server is running
    console.log('\n4. Testing API endpoint:');
    try {
      const response = await axios.get('http://localhost:3001/api/v1/locations');
      console.log(`   API Response status: ${response.status}`);
      console.log(`   API returned ${response.data.locations?.length || 0} locations`);
      
      if (response.data.locations?.length !== locations.length) {
        console.log(`   ⚠️  API count (${response.data.locations?.length}) doesn't match DB count (${locations.length})`);
      }
    } catch (error) {
      console.log('   ❌ Could not reach API (is the server running?)');
    }
    
    // 5. Check for the most common location format issues
    console.log('\n5. Location format analysis:');
    const locationFormats = new Map();
    
    locations.forEach(loc => {
      const hasSubLocation = loc.name.includes(' - ');
      const format = hasSubLocation ? 'Main - Sub' : 'Single';
      locationFormats.set(format, (locationFormats.get(format) || 0) + 1);
    });
    
    locationFormats.forEach((count, format) => {
      console.log(`   ${format} format: ${count} locations`);
    });
    
    // 6. Show unique main locations (before the dash)
    console.log('\n6. Unique main locations (ignoring sub-locations):');
    const mainLocations = new Set();
    locations.forEach(loc => {
      const mainLoc = loc.name.split(' - ')[0].trim();
      mainLocations.add(mainLoc);
    });
    
    console.log(`   Found ${mainLocations.size} unique main locations:`);
    Array.from(mainLocations).sort().forEach(loc => {
      console.log(`   - ${loc}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLocationAPI();