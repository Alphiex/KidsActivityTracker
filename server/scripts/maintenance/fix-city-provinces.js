/**
 * Fix City/Province Data
 *
 * This script corrects province information for Canadian cities in both
 * the Location and City tables.
 */

const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

// Comprehensive mapping of Canadian cities to their correct provinces
const CITY_PROVINCE_MAP = {
  // British Columbia (BC)
  'Abbotsford': 'BC',
  'Anmore': 'BC',
  'Belcarra': 'BC',
  'Bowen Island': 'BC',
  'Burnaby': 'BC',
  'Campbell River': 'BC',
  'Chilliwack': 'BC',
  'Coquitlam': 'BC',
  'Courtenay': 'BC',
  'Deep Cove': 'BC',
  'Delta': 'BC',
  'Kamloops': 'BC',
  'Kelowna': 'BC',
  'Ladner': 'BC',
  'Langley': 'BC',
  'Lions Bay': 'BC',
  'Lynn Valley': 'BC',
  'Maple Ridge': 'BC',
  'Nanaimo': 'BC',
  'New Westminster': 'BC',
  'North Vancouver': 'BC',
  'Pemberton': 'BC',
  'Pitt Meadows': 'BC',
  'Port Coquitlam': 'BC',
  'Port Moody': 'BC',
  'Prince George': 'BC',
  'Richmond': 'BC',
  'Saanich': 'BC',
  'Squamish': 'BC',
  'Surrey': 'BC',
  'Tsawwassen': 'BC',
  'Vancouver': 'BC',
  'Vernon': 'BC',
  'Victoria': 'BC',
  'West Vancouver': 'BC',
  'Whistler': 'BC',
  'White Rock': 'BC',

  // Alberta (AB)
  'Airdrie': 'AB',
  'Calgary': 'AB',
  'Edmonton': 'AB',
  'Lethbridge': 'AB',
  'Red Deer': 'AB',
  'Strathcona County': 'AB',
  'St. Albert': 'AB',
  'Spruce Grove': 'AB',
  'Leduc': 'AB',
  'Fort McMurray': 'AB',
  'Grande Prairie': 'AB',
  'Medicine Hat': 'AB',

  // Saskatchewan (SK)
  'Regina': 'SK',
  'Saskatoon': 'SK',
  'Moose Jaw': 'SK',
  'Prince Albert': 'SK',

  // Manitoba (MB)
  'Winnipeg': 'MB',
  'Brandon': 'MB',
  'Steinbach': 'MB',

  // Ontario (ON)
  'Ajax': 'ON',
  'Aurora': 'ON',
  'Barrie': 'ON',
  'Brampton': 'ON',
  'Brantford': 'ON',
  'Burlington': 'ON',
  'Caledon': 'ON',
  'Cambridge': 'ON',
  'Chatham-Kent': 'ON',
  'Clarington': 'ON',
  'Greater Sudbury': 'ON',
  'Guelph': 'ON',
  'Hamilton': 'ON',
  'King': 'ON',
  'Kingston': 'ON',
  'Kitchener': 'ON',
  'London': 'ON',
  'Markham': 'ON',
  'Milton': 'ON',
  'Mississauga': 'ON',
  'Newmarket': 'ON',
  'Niagara Falls': 'ON',
  'Oakville': 'ON',
  'Oshawa': 'ON',
  'Ottawa': 'ON',
  'Peterborough': 'ON',
  'Pickering': 'ON',
  'Richmond Hill': 'ON',
  'St. Catharines': 'ON',
  'Thunder Bay': 'ON',
  'Toronto': 'ON',
  'Vaughan': 'ON',
  'Waterloo': 'ON',
  'Whitby': 'ON',
  'Whitchurch-Stouffville': 'ON',
  'Windsor': 'ON',

  // Quebec (QC)
  'Dorval': 'QC',
  'Gatineau': 'QC',
  'Laval': 'QC',
  'Longueuil': 'QC',
  'Montreal': 'QC',
  'Quebec City': 'QC',
  'Sherbrooke': 'QC',
  'Trois-Rivières': 'QC',

  // Nova Scotia (NS)
  'Halifax': 'NS',
  'Dartmouth': 'NS',
  'Sydney': 'NS',

  // New Brunswick (NB)
  'Fredericton': 'NB',
  'Moncton': 'NB',
  'Saint John': 'NB',

  // Newfoundland and Labrador (NL)
  "St. John's": 'NL',
  'Mount Pearl': 'NL',
  'Corner Brook': 'NL',

  // Prince Edward Island (PE)
  'Charlottetown': 'PE',
  'Summerside': 'PE',

  // Northwest Territories (NT)
  'Yellowknife': 'NT',

  // Yukon (YT)
  'Whitehorse': 'YT',

  // Nunavut (NU)
  'Iqaluit': 'NU',
};

// Province code to full name mapping
const PROVINCE_NAMES = {
  'BC': 'British Columbia',
  'AB': 'Alberta',
  'SK': 'Saskatchewan',
  'MB': 'Manitoba',
  'ON': 'Ontario',
  'QC': 'Quebec',
  'NS': 'Nova Scotia',
  'NB': 'New Brunswick',
  'NL': 'Newfoundland and Labrador',
  'PE': 'Prince Edward Island',
  'NT': 'Northwest Territories',
  'YT': 'Yukon',
  'NU': 'Nunavut',
};

async function fixCityProvinces() {
  console.log('=== Starting City/Province Fix ===\n');

  // Step 1: Fix Location table
  console.log('Step 1: Fixing Location table...');
  let locationUpdates = 0;

  for (const [cityName, correctProvince] of Object.entries(CITY_PROVINCE_MAP)) {
    // Find locations with wrong province
    const wrongLocations = await prisma.location.findMany({
      where: {
        city: cityName,
        NOT: { province: correctProvince }
      }
    });

    if (wrongLocations.length > 0) {
      console.log(`  ${cityName}: Found ${wrongLocations.length} locations with wrong province`);

      // Get the wrong provinces for logging
      const wrongProvinces = [...new Set(wrongLocations.map(l => l.province))];
      console.log(`    Wrong provinces: ${wrongProvinces.join(', ')} → Correcting to: ${correctProvince}`);

      // Update all locations
      const result = await prisma.location.updateMany({
        where: {
          city: cityName,
          NOT: { province: correctProvince }
        },
        data: { province: correctProvince }
      });

      locationUpdates += result.count;
    }
  }

  console.log(`\n  Total Location records updated: ${locationUpdates}\n`);

  // Step 2: Fix City table
  console.log('Step 2: Fixing City table...');
  let cityUpdates = 0;
  let citiesMerged = 0;

  for (const [cityName, correctProvince] of Object.entries(CITY_PROVINCE_MAP)) {
    // Check if there's a city with wrong province
    const wrongCities = await prisma.city.findMany({
      where: {
        name: cityName,
        NOT: { province: correctProvince }
      }
    });

    // Check if there's already a correct city record
    const correctCity = await prisma.city.findFirst({
      where: {
        name: cityName,
        province: correctProvince
      }
    });

    for (const wrongCity of wrongCities) {
      console.log(`  ${cityName}: Found city with wrong province ${wrongCity.province} → ${correctProvince}`);

      if (correctCity) {
        // Merge: Update locations pointing to wrong city to point to correct city
        const locationsToUpdate = await prisma.location.updateMany({
          where: { cityId: wrongCity.id },
          data: { cityId: correctCity.id }
        });

        console.log(`    Merged ${locationsToUpdate.count} locations from ${wrongCity.province} city to ${correctProvince} city`);

        // Delete the wrong city record
        await prisma.city.delete({ where: { id: wrongCity.id } });
        citiesMerged++;
      } else {
        // No correct city exists, just update the province
        await prisma.city.update({
          where: { id: wrongCity.id },
          data: { province: correctProvince }
        });
        cityUpdates++;
      }
    }
  }

  console.log(`\n  City records updated: ${cityUpdates}`);
  console.log(`  City records merged and deleted: ${citiesMerged}\n`);

  // Step 3: Normalize province formats (e.g., "Ontario" → "ON", "British Columbia" → "BC")
  console.log('Step 3: Normalizing province formats...');

  // Build reverse lookup from full name to code
  const provinceNameToCode = {};
  for (const [code, name] of Object.entries(PROVINCE_NAMES)) {
    provinceNameToCode[name] = code;
    provinceNameToCode[name.toLowerCase()] = code;
  }

  // Fix locations with full province names
  for (const [fullName, code] of Object.entries(provinceNameToCode)) {
    const result = await prisma.location.updateMany({
      where: { province: fullName },
      data: { province: code }
    });
    if (result.count > 0) {
      console.log(`  Normalized "${fullName}" → "${code}": ${result.count} locations`);
    }
  }

  // Step 4: Verify results
  console.log('\n=== Verification ===\n');

  // Check for any remaining mismatches
  const remainingIssues = [];

  for (const [cityName, correctProvince] of Object.entries(CITY_PROVINCE_MAP)) {
    const wrongLocations = await prisma.location.count({
      where: {
        city: cityName,
        NOT: { province: correctProvince }
      }
    });

    if (wrongLocations > 0) {
      remainingIssues.push(`${cityName}: ${wrongLocations} locations still have wrong province`);
    }
  }

  if (remainingIssues.length > 0) {
    console.log('Remaining issues:');
    remainingIssues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('All known cities have correct provinces!');
  }

  // Show current state
  console.log('\n=== Final State ===\n');

  const finalLocations = await prisma.location.groupBy({
    by: ['city', 'province'],
    _count: { id: true },
    orderBy: [{ city: 'asc' }, { province: 'asc' }]
  });

  console.log('Location city/province combinations:');
  finalLocations.forEach(l => {
    const expectedProvince = CITY_PROVINCE_MAP[l.city];
    const status = expectedProvince && expectedProvince !== l.province ? ' ⚠️ WRONG' : '';
    console.log(`  ${l.city}, ${l.province}: ${l._count.id} locations${status}`);
  });

  console.log('\n=== Done ===');
}

// Run the script
fixCityProvinces()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
