/**
 * Backfill Child Coordinates
 *
 * This script finds all children without coordinates in their savedAddress
 * and geocodes their city to add latitude/longitude.
 *
 * Usage:
 *   node server/scripts/maintenance/backfill-child-coordinates.js
 *   node server/scripts/maintenance/backfill-child-coordinates.js --dry-run
 */

const { PrismaClient } = require('../../generated/prisma');
const https = require('https');

const prisma = new PrismaClient();

// Rate limiting for Nominatim (1 request per second)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 */
async function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

    const options = {
      headers: {
        'User-Agent': 'KidsActivityTracker/1.0 (backfill script)',
      },
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results && results.length > 0) {
            resolve({
              latitude: parseFloat(results[0].lat),
              longitude: parseFloat(results[0].lon),
              displayName: results[0].display_name,
            });
          } else {
            resolve(null);
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Backfill Child Coordinates');
  console.log(isDryRun ? '(DRY RUN - no changes will be made)' : '(LIVE RUN)');
  console.log('='.repeat(60));
  console.log();

  // Find all children with their preferences
  const children = await prisma.child.findMany({
    include: {
      preferences: true,
    },
  });

  console.log(`Found ${children.length} children total`);
  console.log();

  let needsGeocode = [];
  let alreadyHasCoords = 0;
  let noLocation = 0;

  for (const child of children) {
    const prefs = child.preferences;
    const savedAddress = prefs?.savedAddress;

    // Check if already has coordinates
    if (savedAddress?.latitude && savedAddress?.longitude) {
      alreadyHasCoords++;
      continue;
    }

    // Check deprecated locationDetails for coordinates
    const locDetails = child.locationDetails;
    if (locDetails?.latitude && locDetails?.longitude) {
      // Has coordinates in deprecated field - migrate them
      needsGeocode.push({
        child,
        source: 'locationDetails',
        coords: { latitude: locDetails.latitude, longitude: locDetails.longitude },
        city: locDetails.city || savedAddress?.city || child.location,
      });
      continue;
    }

    // Check for city to geocode
    const city = savedAddress?.city || child.location;
    if (city) {
      needsGeocode.push({
        child,
        source: 'geocode',
        city,
      });
    } else {
      noLocation++;
    }
  }

  console.log(`Already have coordinates: ${alreadyHasCoords}`);
  console.log(`Need geocoding: ${needsGeocode.length}`);
  console.log(`No location data: ${noLocation}`);
  console.log();

  if (needsGeocode.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  // Process each child that needs geocoding
  let updated = 0;
  let failed = 0;

  for (const item of needsGeocode) {
    const { child, source, city, coords } = item;
    console.log(`Processing: ${child.name} (${child.id})`);
    console.log(`  Source: ${source}`);

    let finalCoords = coords;

    if (source === 'geocode') {
      console.log(`  City: ${city}`);

      // Rate limit
      await sleep(1100);

      try {
        const searchQuery = `${city}, Canada`;
        console.log(`  Geocoding: "${searchQuery}"`);

        const result = await geocodeAddress(searchQuery);

        if (result) {
          console.log(`  Found: ${result.latitude}, ${result.longitude}`);
          console.log(`  Display: ${result.displayName}`);
          finalCoords = { latitude: result.latitude, longitude: result.longitude };
        } else {
          console.log(`  ERROR: Could not geocode`);
          failed++;
          continue;
        }
      } catch (err) {
        console.log(`  ERROR: ${err.message}`);
        failed++;
        continue;
      }
    } else {
      console.log(`  Using existing coords: ${finalCoords.latitude}, ${finalCoords.longitude}`);
    }

    if (!isDryRun) {
      // Get current savedAddress or create new one
      const currentAddress = child.preferences?.savedAddress || {};
      const newAddress = {
        ...currentAddress,
        city: city || currentAddress.city,
        latitude: finalCoords.latitude,
        longitude: finalCoords.longitude,
        formattedAddress: currentAddress.formattedAddress || city,
        updatedAt: new Date().toISOString(),
      };

      // Upsert preferences
      if (child.preferences) {
        await prisma.childPreferences.update({
          where: { id: child.preferences.id },
          data: {
            savedAddress: newAddress,
            locationSource: 'saved_address',
          },
        });
      } else {
        await prisma.childPreferences.create({
          data: {
            childId: child.id,
            savedAddress: newAddress,
            locationSource: 'saved_address',
          },
        });
      }
      console.log(`  UPDATED`);
    } else {
      console.log(`  Would update (dry run)`);
    }

    updated++;
    console.log();
  }

  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Already had coordinates: ${alreadyHasCoords}`);
  console.log(`  No location data: ${noLocation}`);
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
