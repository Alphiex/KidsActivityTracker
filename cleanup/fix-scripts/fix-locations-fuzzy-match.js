#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Helper function to normalize location names for comparison
function normalizeLocationName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/community recreation centre/g, 'rec centre')
    .replace(/community centre/g, 'rec centre')
    .replace(/recreation centre/g, 'rec centre')
    .replace(/rec center/g, 'rec centre')
    .replace(/community center/g, 'rec centre')
    .replace(/recreation center/g, 'rec centre')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim();
}

// Calculate similarity between two strings
function calculateSimilarity(str1, str2) {
  const s1 = normalizeLocationName(str1);
  const s2 = normalizeLocationName(str2);
  
  if (s1 === s2) return 1;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Simple word overlap
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const totalWords = Math.max(words1.length, words2.length);
  
  return commonWords / totalWords;
}

// Known correct location names from NVRC
const CANONICAL_LOCATIONS = [
  'Delbrook Community Recreation Centre',
  'Harry Jerome Community Recreation Centre',
  'John Braithwaite Community Centre',
  'Karen Magnussen Community Recreation Centre',
  'Parkgate Community Centre',
  'Ron Andrews Community Recreation Centre',
  'Lynn Valley Elementary',
  'Norgate Elementary',
  'Brooksbank Elementary',
  'Capilano Elementary',
  'Canyon Heights Elementary',
  'Cleveland Elementary',
  'Dorothy Lynas Elementary',
  'Highlands Elementary',
  'Larson Elementary',
  'Lynn Valley Elementary',
  'Lynnmour Elementary',
  'Montroyal Elementary',
  'Norgate Elementary',
  'Queen Mary Elementary',
  'Ridgeway Elementary',
  'Ross Road Elementary',
  'Seymour Heights Elementary',
  'Sherwood Park Elementary',
  'Upper Lynn Elementary',
  'Westview Elementary',
  'Argyle Secondary',
  'Carson Graham Secondary',
  'Handsworth Secondary',
  'Seycove Secondary',
  'Sutherland Secondary',
  'Windsor Secondary',
  'North Vancouver Tennis Centre',
  'Grant Connell Tennis Centre',
  'Mickey McDougall Tennis Courts',
  'Murdo Frazer Tennis Courts',
  'Inter River Park',
  'Kirkstone Park',
  'Lynn Valley Village'
];

async function fixLocationsFuzzyMatch() {
  try {
    console.log('🔍 Analyzing all locations with fuzzy matching...\n');
    
    // Get all locations
    const allLocations = await prisma.location.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      },
      orderBy: [
        { name: 'asc' }
      ]
    });
    
    console.log(`Found ${allLocations.length} total locations in database\n`);
    
    // Group locations by similarity
    const locationGroups = {};
    const processedIds = new Set();
    
    for (const location of allLocations) {
      if (processedIds.has(location.id)) continue;
      
      // Find the best canonical match
      let bestMatch = null;
      let bestScore = 0;
      
      for (const canonical of CANONICAL_LOCATIONS) {
        const score = calculateSimilarity(location.name, canonical);
        if (score > bestScore && score >= 0.7) {
          bestScore = score;
          bestMatch = canonical;
        }
      }
      
      // If we found a canonical match, use it
      const groupKey = bestMatch || location.name;
      
      if (!locationGroups[groupKey]) {
        locationGroups[groupKey] = [];
      }
      
      // Find all similar locations
      for (const otherLoc of allLocations) {
        if (!processedIds.has(otherLoc.id)) {
          const similarity = calculateSimilarity(location.name, otherLoc.name);
          if (similarity >= 0.7 || (bestMatch && calculateSimilarity(otherLoc.name, bestMatch) >= 0.7)) {
            locationGroups[groupKey].push(otherLoc);
            processedIds.add(otherLoc.id);
          }
        }
      }
    }
    
    console.log(`\n📊 Grouped into ${Object.keys(locationGroups).length} unique locations\n`);
    
    // Process each group
    let totalActivitiesUpdated = 0;
    let totalLocationsDeleted = 0;
    
    for (const [canonicalName, locations] of Object.entries(locationGroups)) {
      if (locations.length === 1) continue;
      
      console.log(`\n📍 Processing group: ${canonicalName}`);
      console.log(`   Found ${locations.length} similar locations:`);
      
      locations.forEach(loc => {
        console.log(`   - "${loc.name}" (${loc._count.activities} activities)`);
      });
      
      // Choose the primary location (prefer canonical name, then most activities)
      let primaryLocation = locations.find(l => CANONICAL_LOCATIONS.includes(l.name));
      if (!primaryLocation) {
        primaryLocation = locations.reduce((best, current) => 
          current._count.activities > best._count.activities ? current : best
        );
      }
      
      // Update primary location to canonical name if needed
      if (CANONICAL_LOCATIONS.includes(canonicalName) && primaryLocation.name !== canonicalName) {
        await prisma.location.update({
          where: { id: primaryLocation.id },
          data: { name: canonicalName }
        });
        console.log(`   ✅ Updated primary location name to: ${canonicalName}`);
      }
      
      // Merge all others into primary
      const otherLocationIds = locations
        .filter(l => l.id !== primaryLocation.id)
        .map(l => l.id);
      
      if (otherLocationIds.length > 0) {
        // Update addresses if primary doesn't have one
        if (!primaryLocation.address || primaryLocation.address.length < 5) {
          const withAddress = locations.find(l => l.address && l.address.length > 5);
          if (withAddress) {
            await prisma.location.update({
              where: { id: primaryLocation.id },
              data: {
                address: withAddress.address,
                city: withAddress.city || primaryLocation.city,
                province: withAddress.province || primaryLocation.province,
                postalCode: withAddress.postalCode || primaryLocation.postalCode,
                latitude: withAddress.latitude || primaryLocation.latitude,
                longitude: withAddress.longitude || primaryLocation.longitude
              }
            });
            console.log(`   ✅ Updated primary location with address from: ${withAddress.name}`);
          }
        }
        
        // Move all activities
        const updateResult = await prisma.activity.updateMany({
          where: {
            locationId: { in: otherLocationIds }
          },
          data: {
            locationId: primaryLocation.id
          }
        });
        
        totalActivitiesUpdated += updateResult.count;
        console.log(`   ✅ Moved ${updateResult.count} activities to primary location`);
        
        // Delete duplicates
        const deleteResult = await prisma.location.deleteMany({
          where: {
            id: { in: otherLocationIds }
          }
        });
        
        totalLocationsDeleted += deleteResult.count;
        console.log(`   🗑️  Deleted ${deleteResult.count} duplicate locations`);
      }
    }
    
    // Clean up any locations with no activities
    console.log('\n\n🧹 Cleaning up empty locations...');
    
    const emptyLocations = await prisma.location.findMany({
      where: {
        activities: {
          none: {}
        }
      }
    });
    
    if (emptyLocations.length > 0) {
      const deleteResult = await prisma.location.deleteMany({
        where: {
          activities: {
            none: {}
          }
        }
      });
      
      console.log(`🗑️  Deleted ${deleteResult.count} locations with no activities`);
      totalLocationsDeleted += deleteResult.count;
    }
    
    // Final summary
    console.log('\n\n📊 Final Summary:');
    console.log(`✅ Activities updated: ${totalActivitiesUpdated}`);
    console.log(`✅ Locations deleted: ${totalLocationsDeleted}`);
    
    const finalCount = await prisma.location.count();
    const withActivities = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT l.id) as count
      FROM "Location" l
      INNER JOIN "Activity" a ON a."locationId" = l.id
      WHERE a."isActive" = true
    `;
    
    console.log(`✅ Total locations remaining: ${finalCount}`);
    console.log(`✅ Locations with active activities: ${withActivities[0].count}`);
    
    // List final locations
    console.log('\n\n📍 Final location list:');
    const finalLocations = await prisma.location.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    finalLocations.forEach((loc, idx) => {
      console.log(`${idx + 1}. ${loc.name} (${loc._count.activities} activities)`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run with DATABASE_URL
fixLocationsFuzzyMatch();