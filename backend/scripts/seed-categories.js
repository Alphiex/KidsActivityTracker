require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function seedCategories() {
  console.log('🌱 Seeding Categories...\n');
  
  const categories = [
    {
      code: 'baby-parent',
      name: 'Baby & Parent',
      ageMin: 0,
      ageMax: 1,
      requiresParent: true,
      description: 'Activities for babies with parent participation',
      displayOrder: 1
    },
    {
      code: 'early-years-solo',
      name: 'Early Years Solo',
      ageMin: 2,
      ageMax: 6,
      requiresParent: false,
      description: 'Activities for young children without parent participation',
      displayOrder: 2
    },
    {
      code: 'early-years-parent',
      name: 'Early Years with Parent',
      ageMin: 2,
      ageMax: 6,
      requiresParent: true,
      description: 'Activities for young children with parent participation',
      displayOrder: 3
    },
    {
      code: 'school-age',
      name: 'School Age',
      ageMin: 5,
      ageMax: 13,
      requiresParent: false,
      description: 'Activities for school-aged children',
      displayOrder: 4
    },
    {
      code: 'youth',
      name: 'Youth',
      ageMin: 10,
      ageMax: 18,
      requiresParent: false,
      description: 'Activities for teenagers and young adults',
      displayOrder: 5
    }
  ];
  
  try {
    for (const category of categories) {
      const created = await prisma.category.upsert({
        where: { code: category.code },
        update: category,
        create: category
      });
      
      console.log(`✅ Created/Updated category: ${created.name} (${created.code})`);
      console.log(`   Ages: ${created.ageMin}-${created.ageMax}, Parent Required: ${created.requiresParent}`);
    }
    
    console.log(`\n✨ Successfully seeded ${categories.length} categories`);
    
    // Verify
    const count = await prisma.category.count();
    console.log(`📊 Total categories in database: ${count}`);
    
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedCategories()
  .then(() => {
    console.log('\n✅ Category seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Category seeding failed:', error);
    process.exit(1);
  });