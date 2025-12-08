const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

// Vancouver Metro Area cities
const VANCOUVER_METRO_CITIES = [
  { name: 'Vancouver', province: 'BC', country: 'Canada' },
  { name: 'North Vancouver', province: 'BC', country: 'Canada' },
  { name: 'West Vancouver', province: 'BC', country: 'Canada' },
  { name: 'Burnaby', province: 'BC', country: 'Canada' },
  { name: 'Richmond', province: 'BC', country: 'Canada' },
  { name: 'Surrey', province: 'BC', country: 'Canada' },
  { name: 'Coquitlam', province: 'BC', country: 'Canada' },
  { name: 'Port Coquitlam', province: 'BC', country: 'Canada' },
  { name: 'Port Moody', province: 'BC', country: 'Canada' },
  { name: 'New Westminster', province: 'BC', country: 'Canada' },
  { name: 'Delta', province: 'BC', country: 'Canada' },
  { name: 'Langley', province: 'BC', country: 'Canada' },
  { name: 'White Rock', province: 'BC', country: 'Canada' },
  { name: 'Maple Ridge', province: 'BC', country: 'Canada' },
  { name: 'Pitt Meadows', province: 'BC', country: 'Canada' },
  { name: 'Ladner', province: 'BC', country: 'Canada' },
  { name: 'Tsawwassen', province: 'BC', country: 'Canada' },
  { name: 'Lynn Valley', province: 'BC', country: 'Canada' },
  { name: 'Deep Cove', province: 'BC', country: 'Canada' },
  { name: 'Squamish', province: 'BC', country: 'Canada' },
  { name: 'Whistler', province: 'BC', country: 'Canada' },
  { name: 'Lions Bay', province: 'BC', country: 'Canada' },
  { name: 'Bowen Island', province: 'BC', country: 'Canada' },
  { name: 'Anmore', province: 'BC', country: 'Canada' },
  { name: 'Belcarra', province: 'BC', country: 'Canada' },
];

async function main() {
  console.log('🏙️ Seeding Vancouver Metro Area cities...');

  let created = 0;
  let existing = 0;

  for (const city of VANCOUVER_METRO_CITIES) {
    try {
      const result = await prisma.city.upsert({
        where: {
          name_province_country: {
            name: city.name,
            province: city.province,
            country: city.country
          }
        },
        update: {},
        create: city
      });

      if (result) {
        // Check if it was newly created by comparing timestamps
        const timeDiff = new Date() - new Date(result.createdAt);
        if (timeDiff < 5000) {
          console.log(`✅ Created city: ${result.name}, ${result.province}`);
          created++;
        } else {
          console.log(`⏩ City already exists: ${result.name}, ${result.province}`);
          existing++;
        }
      }
    } catch (error) {
      console.error(`❌ Error creating city ${city.name}:`, error.message);
    }
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`   Created: ${created} new cities`);
  console.log(`   Existing: ${existing} cities`);
  console.log(`   Total: ${VANCOUVER_METRO_CITIES.length} cities`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
