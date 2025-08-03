const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create NVRC provider
  const nvrc = await prisma.provider.upsert({
    where: { name: 'NVRC' },
    update: {},
    create: {
      name: 'NVRC',
      website: 'https://www.nvrc.ca',
      scraperConfig: {
        scraperClass: 'nvrcWorkingHierarchicalScraper',
        searchUrl: 'https://www.nvrc.ca/programs-memberships/find-program',
        ageGroups: [
          '0 - 6 years, Parent Participation',
          '0 - 6 years, On My Own',
          '5 - 13 years, School Age',
          '10 - 18 years, Youth'
        ],
        timeoutMinutes: 30
      },
      isActive: true
    }
  });

  console.log('✅ Created NVRC provider:', nvrc.id);

  // Create some test locations if they don't exist
  const locations = [
    {
      name: 'Ron Andrews Community Recreation Centre',
      address: '931 Lytton St',
      city: 'North Vancouver',
      province: 'BC',
      postalCode: 'V7H 2A4'
    },
    {
      name: 'Delbrook Community Recreation Centre',
      address: '851 West Queens Rd',
      city: 'North Vancouver',
      province: 'BC',
      postalCode: 'V7N 4E3'
    },
    {
      name: 'Harry Jerome Community Recreation Centre',
      address: '123 East 23rd St',
      city: 'North Vancouver',
      province: 'BC',
      postalCode: 'V7L 3C8'
    }
  ];

  for (const location of locations) {
    const created = await prisma.location.upsert({
      where: {
        name_address: {
          name: location.name,
          address: location.address
        }
      },
      update: {},
      create: location
    });
    console.log(`✅ Created location: ${created.name}`);
  }

  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        ageRange: { min: 5, max: 12 },
        preferredCategories: ['Swimming', 'Camps'],
        maxCost: 200
      }
    }
  });

  console.log('✅ Created test user:', testUser.email);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });