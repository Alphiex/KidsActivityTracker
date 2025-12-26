#!/usr/bin/env node
/**
 * Geocoding Script for Location Data
 *
 * This script geocodes locations that are missing coordinates using the Google Maps Geocoding API.
 * It processes locations in batches with rate limiting to respect API quotas.
 *
 * Prerequisites:
 * - GOOGLE_MAPS_API_KEY environment variable must be set
 *
 * Usage:
 *   node geocodeLocations.js [--dry-run] [--limit=100] [--provider=name]
 */

const { PrismaClient } = require('../../generated/prisma');
const https = require('https');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 500;
const providerArg = args.find(a => a.startsWith('--provider='));
const providerFilter = providerArg ? providerArg.split('=')[1] : null;

// Google Maps API key
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Geocode an address using Google Maps Geocoding API
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string} | null>}
 */
async function geocodeAddress(address) {
  if (!API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY environment variable is not set');
    return null;
  }

  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${API_KEY}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results.length > 0) {
            const location = result.results[0].geometry.location;
            resolve({
              lat: location.lat,
              lng: location.lng,
              formattedAddress: result.results[0].formatted_address
            });
          } else {
            console.log(`  Geocoding failed for "${address}": ${result.status}`);
            resolve(null);
          }
        } catch (e) {
          console.error(`  Error parsing geocode response: ${e.message}`);
          resolve(null);
        }
      });
    }).on('error', (e) => {
      console.error(`  HTTP error for geocoding: ${e.message}`);
      resolve(null);
    });
  });
}

/**
 * Build a searchable address string from location data
 */
function buildAddressString(location, activity = null) {
  const parts = [];

  // Use location name if it looks like an address
  if (location.name && !location.name.toLowerCase().includes('online')) {
    parts.push(location.name);
  }

  // Add address if available
  if (location.address && location.address.length > 3) {
    parts.push(location.address);
  }

  // Add fullAddress if available
  if (location.fullAddress && location.fullAddress.length > 3) {
    parts.push(location.fullAddress);
  }

  // Add city
  if (location.city && location.city !== 'Unknown') {
    parts.push(location.city);
  }

  // Add province/country
  if (location.province) {
    parts.push(location.province);
  }
  parts.push('Canada');

  return parts.join(', ');
}

/**
 * Main geocoding function
 */
async function geocodeLocations() {
  console.log('Location Geocoding Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (updating database)'}`);
  console.log(`Limit: ${limit} locations`);
  if (providerFilter) console.log(`Provider filter: ${providerFilter}`);
  console.log('');

  if (!API_KEY) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable is required');
    console.log('Set it with: export GOOGLE_MAPS_API_KEY=your_api_key');
    process.exit(1);
  }

  // Step 1: Get locations without coordinates
  console.log('Step 1: Finding locations without coordinates...');

  const locationsNeedingGeocode = await prisma.location.findMany({
    where: {
      latitude: null,
      // Exclude online/virtual locations
      NOT: {
        name: { contains: 'Online', mode: 'insensitive' }
      }
    },
    take: limit,
    orderBy: { updatedAt: 'asc' }
  });

  console.log(`Found ${locationsNeedingGeocode.length} locations needing geocoding`);

  if (locationsNeedingGeocode.length === 0) {
    console.log('All locations have coordinates!');
    await prisma.$disconnect();
    return;
  }

  // Step 2: Also get activities without coordinates (for fallback address info)
  console.log('\nStep 2: Getting activity location data for address building...');

  const activitiesWithoutCoords = await prisma.activity.findMany({
    where: {
      isActive: true,
      latitude: null,
      OR: [
        { locationName: { not: null } },
        { fullAddress: { not: null } }
      ]
    },
    select: {
      id: true,
      locationName: true,
      fullAddress: true,
      locationId: true,
      provider: {
        select: { name: true, region: true }
      }
    },
    take: 10000
  });

  // Create a map of locationId -> activity data for address building
  const locationActivityMap = new Map();
  for (const activity of activitiesWithoutCoords) {
    if (activity.locationId && !locationActivityMap.has(activity.locationId)) {
      locationActivityMap.set(activity.locationId, activity);
    }
  }

  console.log(`Found ${activitiesWithoutCoords.length} activities with location data to reference`);

  // Step 3: Geocode each location
  console.log('\nStep 3: Geocoding locations...');

  const stats = {
    processed: 0,
    geocoded: 0,
    failed: 0,
    skipped: 0
  };

  // Rate limit: 50 requests per second (Google's free tier limit)
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_BATCHES = 500; // 500ms

  for (let i = 0; i < locationsNeedingGeocode.length; i += BATCH_SIZE) {
    const batch = locationsNeedingGeocode.slice(i, i + BATCH_SIZE);
    const progress = ((i / locationsNeedingGeocode.length) * 100).toFixed(0);

    console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(locationsNeedingGeocode.length/BATCH_SIZE)} (${progress}%)`);

    for (const location of batch) {
      stats.processed++;

      // Build address string
      const activityData = locationActivityMap.get(location.id);
      let addressStr = buildAddressString(location, activityData);

      // Skip if we don't have enough address info
      if (addressStr.split(',').length < 3) {
        console.log(`  Skipping "${location.name}" - insufficient address data`);
        stats.skipped++;
        continue;
      }

      console.log(`  Geocoding: ${location.name}`);
      console.log(`    Address: ${addressStr}`);

      if (dryRun) {
        console.log(`    [DRY RUN] Would geocode this address`);
        stats.geocoded++;
        continue;
      }

      // Geocode the address
      const result = await geocodeAddress(addressStr);

      if (result) {
        console.log(`    ✅ Found: ${result.lat}, ${result.lng}`);
        console.log(`       Formatted: ${result.formattedAddress}`);

        // Update the location in the database
        await prisma.location.update({
          where: { id: location.id },
          data: {
            latitude: result.lat,
            longitude: result.lng,
            fullAddress: result.formattedAddress
          }
        });

        stats.geocoded++;
      } else {
        console.log(`    ❌ Failed to geocode`);
        stats.failed++;
      }

      // Small delay between individual requests
      await new Promise(r => setTimeout(r, 100));
    }

    // Delay between batches
    if (i + BATCH_SIZE < locationsNeedingGeocode.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }

  // Step 4: Update activities with location coordinates
  console.log('\nStep 4: Propagating coordinates to activities...');

  const updatedActivities = await prisma.$executeRaw`
    UPDATE "Activity" a
    SET latitude = l.latitude,
        longitude = l.longitude,
        "fullAddress" = COALESCE(a."fullAddress", l."fullAddress")
    FROM "Location" l
    WHERE a."locationId" = l.id
      AND a.latitude IS NULL
      AND l.latitude IS NOT NULL
  `;

  console.log(`Updated ${updatedActivities} activities with location coordinates`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Processed: ${stats.processed}`);
  console.log(`Geocoded:  ${stats.geocoded}`);
  console.log(`Failed:    ${stats.failed}`);
  console.log(`Skipped:   ${stats.skipped}`);

  // Final counts
  const finalStats = await prisma.location.aggregate({
    _count: { id: true },
    where: { latitude: { not: null } }
  });

  const totalLocations = await prisma.location.count();

  console.log(`\nLocation coverage: ${finalStats._count.id}/${totalLocations} (${(finalStats._count.id/totalLocations*100).toFixed(1)}%)`);

  const activityStats = await prisma.activity.aggregate({
    _count: { id: true },
    where: { isActive: true, latitude: { not: null } }
  });

  const totalActivities = await prisma.activity.count({ where: { isActive: true } });

  console.log(`Activity coverage: ${activityStats._count.id}/${totalActivities} (${(activityStats._count.id/totalActivities*100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

// Alternative: Geocode using activity data directly
async function geocodeActivities() {
  console.log('\nGeocoding Activities Directly');
  console.log('='.repeat(60));

  // Get activities with address but no coordinates
  const activities = await prisma.activity.findMany({
    where: {
      isActive: true,
      latitude: null,
      OR: [
        { fullAddress: { not: null } },
        { locationName: { not: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      locationName: true,
      fullAddress: true,
      provider: {
        select: { name: true, region: true }
      }
    },
    take: limit
  });

  console.log(`Found ${activities.length} activities to geocode`);

  let geocoded = 0;

  for (const activity of activities) {
    // Build address
    const parts = [];
    if (activity.locationName) parts.push(activity.locationName);
    if (activity.fullAddress) parts.push(activity.fullAddress);
    if (activity.provider?.region) parts.push(activity.provider.region);
    parts.push('BC', 'Canada');

    const address = parts.join(', ');

    console.log(`\nGeocoding: ${activity.name}`);
    console.log(`  Address: ${address}`);

    if (!dryRun) {
      const result = await geocodeAddress(address);
      if (result) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: {
            latitude: result.lat,
            longitude: result.lng,
            fullAddress: result.formattedAddress
          }
        });
        geocoded++;
        console.log(`  ✅ ${result.lat}, ${result.lng}`);
      }
    } else {
      console.log(`  [DRY RUN]`);
      geocoded++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nGeocoded ${geocoded} activities`);
}

// Run the script
geocodeLocations().catch(console.error);
