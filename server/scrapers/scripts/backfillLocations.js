#!/usr/bin/env node

/**
 * Backfill Locations Script
 *
 * This script:
 * 1. Finds all activities without locationId
 * 2. Extracts location info from locationName and provider
 * 3. Creates or finds Location records
 * 4. Links Locations to City records
 * 5. Updates activities with locationId
 *
 * Usage:
 *   node backfillLocations.js                    # Dry run (preview changes)
 *   node backfillLocations.js --execute          # Execute changes
 *   node backfillLocations.js --provider nvrc    # Only process specific provider
 */

const { PrismaClient } = require('../../generated/prisma');

const prisma = new PrismaClient();

// City name mappings and normalizations
const CITY_ALIASES = {
  'north van': 'North Vancouver',
  'north vancouver': 'North Vancouver',
  'n vancouver': 'North Vancouver',
  'west van': 'West Vancouver',
  'west vancouver': 'West Vancouver',
  'w vancouver': 'West Vancouver',
  'vancouver': 'Vancouver',
  'burnaby': 'Burnaby',
  'richmond': 'Richmond',
  'surrey': 'Surrey',
  'coquitlam': 'Coquitlam',
  'port coquitlam': 'Port Coquitlam',
  'port moody': 'Port Moody',
  'new westminster': 'New Westminster',
  'new west': 'New Westminster',
  'delta': 'Delta',
  'ladner': 'Ladner',
  'tsawwassen': 'Tsawwassen',
  'langley': 'Langley',
  'white rock': 'White Rock',
  'maple ridge': 'Maple Ridge',
  'pitt meadows': 'Pitt Meadows',
  'abbotsford': 'Abbotsford',
  'lions bay': 'Lions Bay',
  'bowen island': 'Bowen Island',
  'squamish': 'Squamish',
  'whistler': 'Whistler',
  'calgary': 'Calgary',
  'edmonton': 'Edmonton',
  'saskatoon': 'Saskatoon',
  'regina': 'Regina',
  'winnipeg': 'Winnipeg',
  'toronto': 'Toronto',
  'ottawa': 'Ottawa',
  'montreal': 'Montreal',
  'montréal': 'Montreal',
  'halifax': 'Halifax',
};

// Provider to city mapping (fallback when location doesn't have city info)
const PROVIDER_CITY_MAP = {
  'North Vancouver Recreation Commission': 'North Vancouver',
  'NVRC': 'North Vancouver',
  'West Vancouver Recreation': 'West Vancouver',
  'City of Vancouver Parks & Recreation': 'Vancouver',
  'City of Burnaby Parks & Recreation': 'Burnaby',
  'City of Richmond Community Services': 'Richmond',
  'City of Surrey Parks, Recreation & Culture': 'Surrey',
  'City of Coquitlam Parks & Recreation': 'Coquitlam',
  'City of Port Coquitlam Recreation': 'Port Coquitlam',
  'City of Port Moody Recreation': 'Port Moody',
  'City of New Westminster Parks & Recreation': 'New Westminster',
  'City of Delta Parks & Recreation': 'Delta',
  'City of Langley Recreation': 'Langley',
  'Township of Langley Recreation': 'Langley',
  'City of White Rock Recreation': 'White Rock',
  'City of Maple Ridge Parks & Recreation': 'Maple Ridge',
  'City of Pitt Meadows Recreation': 'Pitt Meadows',
  'City of Abbotsford Parks, Recreation & Culture': 'Abbotsford',
  'Lions Bay Community Recreation': 'Lions Bay',
  'Bowen Island Community Recreation': 'Bowen Island',
  'City of Calgary Recreation - Live and Play': 'Calgary',
  'City of Edmonton - move.learn.play': 'Edmonton',
  'City of Saskatoon Leisure Services': 'Saskatoon',
  'Ville de Montreal Loisirs': 'Montreal',
};

// Province mapping by city
const CITY_PROVINCE_MAP = {
  'North Vancouver': 'BC',
  'West Vancouver': 'BC',
  'Vancouver': 'BC',
  'Burnaby': 'BC',
  'Richmond': 'BC',
  'Surrey': 'BC',
  'Coquitlam': 'BC',
  'Port Coquitlam': 'BC',
  'Port Moody': 'BC',
  'New Westminster': 'BC',
  'Delta': 'BC',
  'Ladner': 'BC',
  'Tsawwassen': 'BC',
  'Langley': 'BC',
  'White Rock': 'BC',
  'Maple Ridge': 'BC',
  'Pitt Meadows': 'BC',
  'Abbotsford': 'BC',
  'Lions Bay': 'BC',
  'Bowen Island': 'BC',
  'Squamish': 'BC',
  'Whistler': 'BC',
  'Calgary': 'AB',
  'Edmonton': 'AB',
  'Saskatoon': 'SK',
  'Regina': 'SK',
  'Winnipeg': 'MB',
  'Toronto': 'ON',
  'Ottawa': 'ON',
  'Montreal': 'QC',
  'Halifax': 'NS',
};

/**
 * Normalize city name
 */
function normalizeCity(cityName) {
  if (!cityName) return null;
  const lower = cityName.toLowerCase().trim();
  return CITY_ALIASES[lower] || cityName.trim();
}

/**
 * Extract city from location name or address
 */
function extractCityFromText(text) {
  if (!text) return null;

  const lower = text.toLowerCase();

  // Check for known city names in the text
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) {
      return city;
    }
  }

  // Try to extract from address patterns like "City, BC" or "City, Province"
  const patterns = [
    /,\s*([^,]+),\s*(?:BC|AB|SK|MB|ON|QC|NS|NB|PE|NL)\b/i,
    /,\s*([^,]+)\s*(?:BC|AB|SK|MB|ON|QC|NS|NB|PE|NL)\s*[A-Z]\d[A-Z]/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      const normalized = normalizeCity(extracted);
      if (normalized && CITY_PROVINCE_MAP[normalized]) {
        return normalized;
      }
    }
  }

  return null;
}

/**
 * Clean and normalize location name
 */
function cleanLocationName(name) {
  if (!name) return null;

  // Remove common suffixes/prefixes that don't help identify the location
  let cleaned = name
    .replace(/^(the|at|@)\s+/i, '')
    .replace(/\s*-\s*\d+\s*[A-Z0-9]+\s*$/i, '') // Remove room numbers at end
    .trim();

  return cleaned || null;
}

/**
 * Find or create a City record
 */
async function findOrCreateCity(cityName, province = 'BC') {
  if (!cityName) return null;

  const normalizedCity = normalizeCity(cityName);
  if (!normalizedCity) return null;

  const cityProvince = CITY_PROVINCE_MAP[normalizedCity] || province;

  // Try to find existing city
  let city = await prisma.city.findFirst({
    where: {
      name: { equals: normalizedCity, mode: 'insensitive' }
    }
  });

  if (!city) {
    // Create new city
    city = await prisma.city.create({
      data: {
        name: normalizedCity,
        province: cityProvince,
        country: 'Canada'
      }
    });
    console.log(`🏙️  Created new city: ${city.name}, ${city.province}`);
  }

  return city;
}

/**
 * Find or create a Location record and link to City
 */
async function findOrCreateLocation(locationName, cityName, fullAddress = null) {
  if (!locationName) return null;

  const cleanedName = cleanLocationName(locationName);
  if (!cleanedName) return null;

  // Try to find existing location by name
  let location = await prisma.location.findFirst({
    where: {
      OR: [
        { name: { equals: cleanedName, mode: 'insensitive' } },
        { name: { equals: locationName, mode: 'insensitive' } }
      ]
    }
  });

  // Find or create the city
  const city = await findOrCreateCity(cityName);

  if (location) {
    // Update city link if missing
    if (!location.cityId && city) {
      location = await prisma.location.update({
        where: { id: location.id },
        data: {
          cityId: city.id,
          city: city.name
        }
      });
      console.log(`🔗 Linked location "${location.name}" to city "${city.name}"`);
    }
    return location;
  }

  // Create new location
  location = await prisma.location.create({
    data: {
      name: cleanedName,
      address: '',
      city: city?.name || cityName || 'Unknown',
      province: city ? CITY_PROVINCE_MAP[city.name] || 'BC' : 'BC',
      country: 'Canada',
      cityId: city?.id || null,
      fullAddress: fullAddress || null
    }
  });

  console.log(`📍 Created new location: "${location.name}" in ${location.city}`);
  return location;
}

/**
 * Process activities for a provider
 */
async function processProviderActivities(provider, dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${provider.name}`);
  console.log(`${'='.repeat(60)}`);

  // Get the city for this provider
  const providerCity = PROVIDER_CITY_MAP[provider.name];
  if (!providerCity) {
    console.log(`⚠️  No city mapping for provider: ${provider.name}`);
  }

  // Find activities without locationId
  const activities = await prisma.activity.findMany({
    where: {
      providerId: provider.id,
      locationId: null
    },
    select: {
      id: true,
      name: true,
      locationName: true,
      fullAddress: true
    }
  });

  console.log(`Found ${activities.length} activities without locationId`);

  if (activities.length === 0) {
    return { processed: 0, linked: 0, created: 0 };
  }

  // Group by location name to batch process
  const locationGroups = new Map();
  for (const activity of activities) {
    const locName = activity.locationName || 'Unknown Location';
    if (!locationGroups.has(locName)) {
      locationGroups.set(locName, []);
    }
    locationGroups.get(locName).push(activity);
  }

  console.log(`Grouped into ${locationGroups.size} unique locations`);

  let stats = { processed: 0, linked: 0, created: 0 };

  for (const [locationName, locationActivities] of locationGroups) {
    // Try to extract city from location name or address
    let cityName = extractCityFromText(locationName);
    if (!cityName && locationActivities[0]?.fullAddress) {
      cityName = extractCityFromText(locationActivities[0].fullAddress);
    }
    // Fall back to provider city
    if (!cityName) {
      cityName = providerCity;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would create/link location: "${locationName}" -> ${cityName || 'Unknown'} (${locationActivities.length} activities)`);
      stats.processed += locationActivities.length;
    } else {
      try {
        const location = await findOrCreateLocation(
          locationName,
          cityName,
          locationActivities[0]?.fullAddress
        );

        if (location) {
          // Update all activities with this location
          const result = await prisma.activity.updateMany({
            where: {
              id: { in: locationActivities.map(a => a.id) }
            },
            data: {
              locationId: location.id
            }
          });

          stats.linked += result.count;
          console.log(`  ✅ Linked ${result.count} activities to "${location.name}"`);
        }

        stats.processed += locationActivities.length;
      } catch (error) {
        console.error(`  ❌ Error processing location "${locationName}":`, error.message);
      }
    }
  }

  return stats;
}

/**
 * Main backfill function
 */
async function backfillLocations(options = {}) {
  const { dryRun = true, providerFilter = null } = options;

  console.log('\n' + '='.repeat(60));
  console.log('LOCATION BACKFILL SCRIPT');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'EXECUTE (making changes)'}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  // Get all providers
  let providers = await prisma.provider.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });

  if (providerFilter) {
    providers = providers.filter(p =>
      p.name.toLowerCase().includes(providerFilter.toLowerCase())
    );
    console.log(`Filtered to ${providers.length} providers matching "${providerFilter}"`);
  }

  // Get stats before
  const [totalActivities, activitiesWithoutLocation] = await Promise.all([
    prisma.activity.count({ where: { isActive: true } }),
    prisma.activity.count({ where: { isActive: true, locationId: null } })
  ]);

  console.log(`\nCurrent Status:`);
  console.log(`  Total active activities: ${totalActivities}`);
  console.log(`  Without locationId: ${activitiesWithoutLocation} (${(activitiesWithoutLocation/totalActivities*100).toFixed(1)}%)`);
  console.log(`  With locationId: ${totalActivities - activitiesWithoutLocation}`);

  // Process each provider
  const totalStats = { processed: 0, linked: 0, created: 0 };

  for (const provider of providers) {
    const stats = await processProviderActivities(provider, dryRun);
    totalStats.processed += stats.processed;
    totalStats.linked += stats.linked;
    totalStats.created += stats.created;
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Activities processed: ${totalStats.processed}`);
  if (!dryRun) {
    console.log(`Activities linked to locations: ${totalStats.linked}`);
    console.log(`New locations created: ${totalStats.created}`);

    // Get stats after
    const afterWithoutLocation = await prisma.activity.count({
      where: { isActive: true, locationId: null }
    });
    console.log(`\nRemaining without locationId: ${afterWithoutLocation}`);
  } else {
    console.log(`\nTo execute changes, run with --execute flag`);
  }

  return totalStats;
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
const providerIndex = args.indexOf('--provider');
const providerFilter = providerIndex !== -1 ? args[providerIndex + 1] : null;

// Run the backfill
backfillLocations({ dryRun, providerFilter })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
