#!/usr/bin/env node

// Improvements for location handling in the scraper

// 1. Add fuzzy matching function to prevent near-duplicates
function normalizeLocationName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/community recreation centre/g, 'community centre')
    .replace(/recreation centre/g, 'rec centre')
    .replace(/rec center/g, 'rec centre')
    .replace(/community center/g, 'community centre')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim();
}

// 2. Improved location finding with fuzzy matching
async function findOrCreateLocation(prisma, locationName, activityData) {
  if (!locationName) return null;
  
  // First try exact match
  let location = await prisma.location.findFirst({
    where: { name: locationName }
  });
  
  if (!location) {
    // Try fuzzy match to catch variations
    const normalized = normalizeLocationName(locationName);
    const allLocations = await prisma.location.findMany();
    
    for (const loc of allLocations) {
      if (normalizeLocationName(loc.name) === normalized) {
        location = loc;
        console.log(`  📍 Found existing location with variation: "${locationName}" matches "${loc.name}"`);
        break;
      }
    }
  }
  
  if (!location) {
    // Extract city from address if available
    let city = 'North Vancouver'; // default
    let province = 'BC';
    let postalCode = '';
    
    if (activityData.fullAddress) {
      // Try to parse address
      const addressParts = activityData.fullAddress.split(',').map(s => s.trim());
      if (addressParts.length >= 2) {
        // Typically: "Street, City, Province PostalCode"
        const lastPart = addressParts[addressParts.length - 1];
        const postalMatch = lastPart.match(/([A-Z]\d[A-Z]\s*\d[A-Z]\d)$/);
        if (postalMatch) {
          postalCode = postalMatch[1];
          province = lastPart.replace(postalMatch[1], '').trim() || province;
        }
        if (addressParts.length >= 3) {
          city = addressParts[addressParts.length - 2] || city;
        }
      }
    }
    
    // Create new location
    location = await prisma.location.create({
      data: {
        name: locationName,
        address: activityData.fullAddress || '',
        city: city,
        province: province,
        postalCode: postalCode,
        facility: determineFacilityType(locationName),
        latitude: activityData.latitude || null,
        longitude: activityData.longitude || null
      }
    });
    console.log(`  📍 Created new location: ${locationName} in ${city}, ${province}`);
  } else {
    // Update location if we have better address info
    const updates = {};
    if (!location.address && activityData.fullAddress) {
      updates.address = activityData.fullAddress;
    }
    if (!location.latitude && activityData.latitude) {
      updates.latitude = activityData.latitude;
    }
    if (!location.longitude && activityData.longitude) {
      updates.longitude = activityData.longitude;
    }
    
    if (Object.keys(updates).length > 0) {
      await prisma.location.update({
        where: { id: location.id },
        data: updates
      });
      console.log(`  📍 Updated location info for: ${locationName}`);
    }
  }
  
  return location;
}

// 3. Enhanced facility type determination
function determineFacilityType(locationName) {
  const name = locationName.toLowerCase();
  
  if (name.includes('recreation centre') || name.includes('rec centre') || 
      name.includes('community centre') || name.includes('community complex')) {
    return 'Recreation Centre';
  }
  if (name.includes('park')) {
    return 'Park';
  }
  if (name.includes('school') || name.includes('elementary') || 
      name.includes('secondary')) {
    return 'School';
  }
  if (name.includes('tennis')) {
    return 'Tennis Facility';
  }
  if (name.includes('ice') || name.includes('rink') || name.includes('arena')) {
    return 'Ice Rink';
  }
  if (name.includes('pool') || name.includes('aquatic')) {
    return 'Aquatic Centre';
  }
  if (name.includes('golf')) {
    return 'Golf Course';
  }
  if (name.includes('gym') || name.includes('fitness')) {
    return 'Fitness Centre';
  }
  
  return 'Other';
}

// 4. Add cleanup for long-inactive activities (optional, run separately)
async function cleanupInactiveActivities(prisma, daysInactive = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  const result = await prisma.activity.deleteMany({
    where: {
      isActive: false,
      lastSeenAt: {
        lt: cutoffDate
      }
    }
  });
  
  console.log(`🗑️  Cleaned up ${result.count} activities inactive for more than ${daysInactive} days`);
  return result.count;
}

module.exports = {
  normalizeLocationName,
  findOrCreateLocation,
  determineFacilityType,
  cleanupInactiveActivities
};