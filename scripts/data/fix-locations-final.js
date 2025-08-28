#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Known correct location names from NVRC (40 locations)
const CANONICAL_LOCATIONS = {
  // Community Recreation Centres (6)
  'delbrook': 'Delbrook Community Recreation Centre',
  'harry jerome': 'Harry Jerome Community Recreation Centre',
  'john braithwaite': 'John Braithwaite Community Centre',
  'karen magnussen': 'Karen Magnussen Community Recreation Centre',
  'parkgate': 'Parkgate Community Centre',
  'ron andrews': 'Ron Andrews Community Recreation Centre',
  
  // Other Community Centres (7)
  'lynn creek': 'Lynn Creek Community Recreation Centre',
  'lynn valley': 'Lynn Valley Community Recreation Centre',
  'memorial': 'Memorial Community Recreation Centre',
  'lions gate': 'Lions Gate Community Recreation Centre',
  'seymour': 'Seymour Community Centre',
  'northlands': 'Northlands Golf Course',
  'lynn valley village': 'Lynn Valley Village Community Complex',
  
  // Parks (15)
  'loutet': 'Loutet Park',
  'myrtle': 'Myrtle Park',
  'princess': 'Princess Park',
  'kirkstone': 'Kirkstone Park',
  'inter river': 'Inter River Park',
  'mahon': 'Mahon Park',
  'sutherland': 'Sutherland Park',
  'waterfront': 'Waterfront Park',
  'kings mill': 'Kings Mill Walk Park',
  'cates': 'Cates Park',
  'eastview': 'Eastview Park',
  'eldon': 'Eldon Park',
  'griffin': 'Griffin Park',
  'victoria': 'Victoria Park',
  'winch': 'Winch Park',
  
  // Tennis/Sports Facilities (4)
  'tennis centre': 'North Vancouver Tennis Centre',
  'grant connell': 'Grant Connell Tennis Centre',
  'mickey mcdougall': 'Mickey McDougall Tennis Courts',
  'murdo frazer': 'Murdo Frazer Tennis Courts',
  
  // Ice Rinks/Sports Complexes (3)
  'canlan': 'Canlan Sports',
  'north shore winter club': 'North Shore Winter Club',
  'ice sports': 'Ice Sports North Shore',
  
  // Schools (5)
  'lynn valley elementary': 'Lynn Valley Elementary',
  'argyle': 'Argyle Secondary',
  'carson graham': 'Carson Graham Secondary',
  'handsworth': 'Handsworth Secondary',
  'sutherland secondary': 'Sutherland Secondary'
};

function findCanonicalLocation(locationName) {
  if (!locationName) return null;
  
  const normalized = locationName.toLowerCase();
  
  // First check for exact matches
  for (const [key, canonical] of Object.entries(CANONICAL_LOCATIONS)) {
    if (normalized.includes(key)) {
      return canonical;
    }
  }
  
  // Check if it's a sub-location (e.g., "Delbrook - Lane 1")
  if (normalized.includes(' - ')) {
    const baseName = normalized.split(' - ')[0];
    for (const [key, canonical] of Object.entries(CANONICAL_LOCATIONS)) {
      if (baseName.includes(key)) {
        return canonical;
      }
    }
  }
  
  return null;
}

async function fixLocationsFinal() {
  try {
    console.log('🔍 Final location cleanup to match NVRC\'s ~40 locations...\n');
    
    // Get all locations
    const allLocations = await prisma.location.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });
    
    console.log(`Found ${allLocations.length} locations in database\n`);
    
    // Map to track canonical locations
    const canonicalMap = new Map();
    const locationsToDelete = [];
    const updates = [];
    
    // Process each location
    for (const location of allLocations) {
      // Skip if it looks like a description (garbage data)
      if (location.name.length > 100 || 
          location.name.includes('workout') ||
          location.name.includes('craft') ||
          location.name.includes('fun and') ||
          location.name.includes('activities') ||
          location.name === 'Sports - Arena Ri' ||
          location.name === 'ity Complex - Ly') {
        
        console.log(`❌ Garbage location to delete: "${location.name.substring(0, 50)}..."`);
        locationsToDelete.push(location);
        
        // Find a default location for these activities
        const defaultCanonical = findCanonicalLocation('parkgate') || 'Parkgate Community Centre';
        updates.push({
          from: location.id,
          to: defaultCanonical,
          activities: location._count.activities
        });
        continue;
      }
      
      // Find canonical name
      const canonical = findCanonicalLocation(location.name);
      
      if (canonical) {
        if (!canonicalMap.has(canonical)) {
          canonicalMap.set(canonical, {
            primary: location,
            duplicates: []
          });
        } else {
          // This is a duplicate
          canonicalMap.get(canonical).duplicates.push(location);
          locationsToDelete.push(location);
          updates.push({
            from: location.id,
            to: canonical,
            activities: location._count.activities
          });
        }
      } else {
        console.log(`⚠️  Unknown location: "${location.name}" (${location._count.activities} activities)`);
        // These might be legitimate but not in our list
      }
    }
    
    console.log(`\n📊 Processing updates for ${Object.values(CANONICAL_LOCATIONS).length} canonical locations\n`);
    
    // First, ensure all canonical locations exist
    for (const canonicalName of Object.values(CANONICAL_LOCATIONS)) {
      if (!canonicalMap.has(canonicalName)) {
        // Try to find existing or create the canonical location
        const existingLocation = await prisma.location.findFirst({
          where: { name: canonicalName }
        });
        
        if (existingLocation) {
          canonicalMap.set(canonicalName, {
            primary: existingLocation,
            duplicates: []
          });
        } else {
          const newLocation = await prisma.location.create({
            data: {
              name: canonicalName,
              address: '',
              city: 'North Vancouver',
              province: 'BC',
              postalCode: '',
              facility: canonicalName.includes('Centre') ? 'Recreation Centre' : 
                       canonicalName.includes('Park') ? 'Park' : 'Other'
            }
          });
          console.log(`✅ Created canonical location: ${canonicalName}`);
          canonicalMap.set(canonicalName, {
            primary: newLocation,
            duplicates: []
          });
        }
      } else {
        // Update existing to canonical name
        const entry = canonicalMap.get(canonicalName);
        if (entry.primary.name !== canonicalName) {
          await prisma.location.update({
            where: { id: entry.primary.id },
            data: { name: canonicalName }
          });
          console.log(`✅ Updated location name to canonical: ${canonicalName}`);
        }
      }
    }
    
    // Process all updates
    console.log('\n📦 Moving activities to canonical locations...\n');
    
    let totalActivitiesMoved = 0;
    
    for (const update of updates) {
      if (update.activities > 0) {
        const targetLocation = canonicalMap.get(update.to)?.primary;
        if (targetLocation) {
          const result = await prisma.activity.updateMany({
            where: { locationId: update.from },
            data: { locationId: targetLocation.id }
          });
          totalActivitiesMoved += result.count;
          console.log(`✅ Moved ${result.count} activities to ${update.to}`);
        }
      }
    }
    
    // Delete all non-canonical locations
    console.log('\n🗑️  Deleting non-canonical locations...\n');
    
    const locationIdsToDelete = locationsToDelete.map(l => l.id);
    
    // Also delete duplicates from canonical map
    for (const [canonical, data] of canonicalMap) {
      for (const dup of data.duplicates) {
        locationIdsToDelete.push(dup.id);
      }
    }
    
    if (locationIdsToDelete.length > 0) {
      const deleteResult = await prisma.location.deleteMany({
        where: {
          id: { in: locationIdsToDelete }
        }
      });
      console.log(`🗑️  Deleted ${deleteResult.count} locations`);
    }
    
    // Delete any remaining locations not in our canonical list
    const remainingLocations = await prisma.location.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });
    
    const unknownWithNoActivities = remainingLocations.filter(loc => 
      !Object.values(CANONICAL_LOCATIONS).includes(loc.name) && 
      loc._count.activities === 0
    );
    
    if (unknownWithNoActivities.length > 0) {
      const deleteResult = await prisma.location.deleteMany({
        where: {
          id: { in: unknownWithNoActivities.map(l => l.id) }
        }
      });
      console.log(`🗑️  Deleted ${deleteResult.count} unknown locations with no activities`);
    }
    
    // Final summary
    console.log('\n\n📊 Final Summary:');
    
    const finalLocations = await prisma.location.findMany({
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
    
    console.log(`✅ Total locations: ${finalLocations.length}`);
    console.log(`✅ Activities moved: ${totalActivitiesMoved}`);
    
    console.log('\n📍 Final location list:');
    let totalActivities = 0;
    finalLocations.forEach((loc, idx) => {
      console.log(`${(idx + 1).toString().padStart(2)}. ${loc.name.padEnd(45)} (${loc._count.activities} activities)`);
      totalActivities += loc._count.activities;
    });
    
    console.log(`\n✅ Total active activities across all locations: ${totalActivities}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run with DATABASE_URL
fixLocationsFinal();