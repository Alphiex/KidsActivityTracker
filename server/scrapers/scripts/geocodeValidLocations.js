#!/usr/bin/env node
/**
 * Targeted geocoding for locations with valid-looking names
 * Filters out garbage data before geocoding
 */

const { PrismaClient } = require('../../generated/prisma');
const https = require('https');

const prisma = new PrismaClient();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Rate limiting
const REQUESTS_PER_SECOND = 10;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function geocodeAddress(address) {
  return new Promise((resolve) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}&region=ca`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results?.length > 0) {
            const location = result.results[0].geometry.location;
            resolve({
              lat: location.lat,
              lng: location.lng,
              formattedAddress: result.results[0].formatted_address
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  console.log('Targeted Location Geocoding');
  console.log('='.repeat(60));

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY required');
    process.exit(1);
  }

  // Get locations with valid-looking names that need geocoding
  const locations = await prisma.location.findMany({
    where: {
      latitude: null,
      name: {
        not: {
          contains: 'participant'  // Filter out garbage
        }
      }
    },
    orderBy: [
      { city: 'asc' },
      { name: 'asc' }
    ]
  });

  // Filter to locations with valid names
  const validLocations = locations.filter(loc => {
    const name = loc.name || '';
    // Must be short (not a description)
    if (name.length > 100) return false;
    // No HTML tags
    if (/<[^>]+>/.test(name)) return false;
    // Not obvious description text
    const badPatterns = ['development', 'instructor', 'experience', 'technique', 'refund', 'cancel', 'enroll', 'prerequisite'];
    const lowerName = name.toLowerCase();
    return !badPatterns.some(p => lowerName.includes(p));
  });

  console.log(`Found ${validLocations.length} valid locations to geocode\n`);

  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < validLocations.length; i++) {
    const loc = validLocations[i];

    // Build address string
    const addressParts = [
      loc.name,
      loc.address,
      loc.city,
      loc.province,
      'Canada'
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');

    // Rate limit
    if (i > 0 && i % REQUESTS_PER_SECOND === 0) {
      await delay(1000);
    }

    // Progress
    if (i % 50 === 0) {
      console.log(`Progress: ${i}/${validLocations.length} (${geocoded} geocoded, ${failed} failed)`);
    }

    const result = await geocodeAddress(fullAddress);

    if (result) {
      await prisma.location.update({
        where: { id: loc.id },
        data: {
          latitude: result.lat,
          longitude: result.lng,
          fullAddress: result.formattedAddress
        }
      });
      geocoded++;
    } else {
      failed++;
    }
  }

  console.log(`\nComplete! Geocoded: ${geocoded}, Failed: ${failed}`);

  // Propagate to activities
  console.log('\nPropagating coordinates to activities...');
  const updateResult = await prisma.$executeRaw`
    UPDATE "Activity" a
    SET latitude = l.latitude, longitude = l.longitude
    FROM "Location" l
    WHERE a."locationId" = l.id
      AND a.latitude IS NULL
      AND l.latitude IS NOT NULL
  `;
  console.log(`Updated ${updateResult} activities with location coordinates`);

  await prisma.$disconnect();
}

main().catch(console.error);
