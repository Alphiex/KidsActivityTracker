#!/usr/bin/env node
/**
 * Location Builder Script
 *
 * This script:
 * 1. Extracts unique location names from all activities
 * 2. Creates/updates Location records with coordinates
 * 3. Links activities to their Location records
 * 4. Reports on location data coverage
 */

const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

async function buildLocationDatabase() {
  console.log('Location Database Builder');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Get all unique locations from activities
  console.log('Step 1: Analyzing activity locations...');

  const activitiesWithLocation = await prisma.activity.findMany({
    where: {
      isActive: true,
      OR: [
        { locationName: { not: null } },
        { latitude: { not: null } },
        { fullAddress: { not: null } }
      ]
    },
    select: {
      id: true,
      locationName: true,
      fullAddress: true,
      latitude: true,
      longitude: true,
      providerId: true,
      provider: {
        select: {
          name: true,
          region: true
        }
      }
    }
  });

  console.log(`Found ${activitiesWithLocation.length} activities with location data`);

  // Step 2: Group by unique location
  const locationMap = new Map();

  for (const activity of activitiesWithLocation) {
    // Create a key from location name (normalized)
    const locationKey = normalizeLocationName(activity.locationName || activity.fullAddress || 'Unknown');

    if (!locationMap.has(locationKey)) {
      locationMap.set(locationKey, {
        name: activity.locationName || 'Unknown',
        address: activity.fullAddress || '',
        latitude: activity.latitude,
        longitude: activity.longitude,
        city: activity.provider?.region || '',
        activities: [],
        providers: new Set()
      });
    }

    const loc = locationMap.get(locationKey);
    loc.activities.push(activity.id);
    loc.providers.add(activity.providerId);

    // Update coordinates if we have them and the location doesn't
    if (!loc.latitude && activity.latitude) {
      loc.latitude = activity.latitude;
      loc.longitude = activity.longitude;
    }

    // Update address if we have a better one
    if (!loc.address && activity.fullAddress) {
      loc.address = activity.fullAddress;
    }
  }

  console.log(`Found ${locationMap.size} unique locations`);

  // Step 3: Get existing locations from database
  console.log('\nStep 2: Checking existing Location records...');

  const existingLocations = await prisma.location.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      latitude: true,
      longitude: true
    }
  });

  const existingLocationMap = new Map();
  for (const loc of existingLocations) {
    const key = normalizeLocationName(loc.name);
    existingLocationMap.set(key, loc);
  }

  console.log(`Found ${existingLocations.length} existing Location records`);

  // Step 4: Create/update locations and get city mappings
  console.log('\nStep 3: Creating/updating Location records...');

  const cities = await prisma.city.findMany({
    select: { id: true, name: true }
  });
  const cityMap = new Map(cities.map(c => [c.name.toLowerCase(), c.id]));

  const stats = {
    created: 0,
    updated: 0,
    withCoords: 0,
    withoutCoords: 0,
    activitiesLinked: 0
  };

  const locationIdMap = new Map(); // Maps location key to database ID

  for (const [key, locData] of locationMap.entries()) {
    try {
      const existing = existingLocationMap.get(key);

      // Determine city ID
      let cityId = null;
      if (locData.city) {
        const cityName = locData.city.toLowerCase().replace('city of ', '').trim();
        cityId = cityMap.get(cityName);
      }

      if (existing) {
        // Update existing location if we have better data
        const updateData = {};

        if (!existing.latitude && locData.latitude) {
          updateData.latitude = locData.latitude;
          updateData.longitude = locData.longitude;
        }

        if (!existing.address && locData.address) {
          updateData.address = locData.address;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.location.update({
            where: { id: existing.id },
            data: updateData
          });
          stats.updated++;
        }

        locationIdMap.set(key, existing.id);
      } else {
        // Create new location
        const newLoc = await prisma.location.create({
          data: {
            name: locData.name,
            address: locData.address || '',
            city: locData.city || 'Unknown',
            province: 'BC',
            country: 'Canada',
            latitude: locData.latitude,
            longitude: locData.longitude,
            cityId: cityId
          }
        });

        locationIdMap.set(key, newLoc.id);
        stats.created++;
      }

      // Track coordinate coverage
      if (locData.latitude) {
        stats.withCoords++;
      } else {
        stats.withoutCoords++;
      }
    } catch (error) {
      console.error(`Error processing location ${locData.name}:`, error.message);
    }
  }

  console.log(`Created ${stats.created} new Location records`);
  console.log(`Updated ${stats.updated} existing Location records`);
  console.log(`Locations with coordinates: ${stats.withCoords}`);
  console.log(`Locations WITHOUT coordinates: ${stats.withoutCoords}`);

  // Step 5: Link activities to locations
  console.log('\nStep 4: Linking activities to Location records...');

  for (const [key, locData] of locationMap.entries()) {
    const locationId = locationIdMap.get(key);
    if (!locationId) continue;

    // Update activities that don't have a locationId
    const result = await prisma.activity.updateMany({
      where: {
        id: { in: locData.activities },
        locationId: null
      },
      data: {
        locationId: locationId
      }
    });

    stats.activitiesLinked += result.count;
  }

  console.log(`Linked ${stats.activitiesLinked} activities to Location records`);

  // Step 6: Summary report
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY REPORT');
  console.log('='.repeat(60));

  const totalActivities = await prisma.activity.count({ where: { isActive: true } });
  const activitiesWithLocationId = await prisma.activity.count({
    where: { isActive: true, locationId: { not: null } }
  });
  const activitiesWithCoords = await prisma.activity.count({
    where: { isActive: true, latitude: { not: null } }
  });
  const locationsWithCoords = await prisma.location.count({
    where: { latitude: { not: null } }
  });
  const totalLocations = await prisma.location.count();

  console.log(`\nActivities:`);
  console.log(`  Total active: ${totalActivities}`);
  console.log(`  With locationId: ${activitiesWithLocationId} (${(activitiesWithLocationId/totalActivities*100).toFixed(1)}%)`);
  console.log(`  With coordinates: ${activitiesWithCoords} (${(activitiesWithCoords/totalActivities*100).toFixed(1)}%)`);

  console.log(`\nLocations:`);
  console.log(`  Total: ${totalLocations}`);
  console.log(`  With coordinates: ${locationsWithCoords} (${(locationsWithCoords/totalLocations*100).toFixed(1)}%)`);

  // List locations without coordinates
  const locationsNeedingGeocode = await prisma.location.findMany({
    where: { latitude: null },
    select: { name: true, address: true, city: true }
  });

  if (locationsNeedingGeocode.length > 0) {
    console.log(`\nLocations needing geocoding (${locationsNeedingGeocode.length}):`);
    locationsNeedingGeocode.slice(0, 20).forEach(loc => {
      console.log(`  - ${loc.name} (${loc.city})`);
    });
    if (locationsNeedingGeocode.length > 20) {
      console.log(`  ... and ${locationsNeedingGeocode.length - 20} more`);
    }
  }

  await prisma.$disconnect();
}

/**
 * Normalize location name for matching
 */
function normalizeLocationName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/community\s*(centre|center)/gi, 'community centre')
    .replace(/recreation\s*(centre|center)/gi, 'recreation centre')
    .replace(/\s+/g, ' ')
    .trim();
}

// Run the builder
buildLocationDatabase().catch(console.error);
