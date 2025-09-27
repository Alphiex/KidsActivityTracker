const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

const categories = [
  {
    name: 'Early Years: Parent Participation',
    description: 'Activities for children 0-5 years that require parent participation',
    ageMin: 0,
    ageMax: 5,
    requiresParent: true,
    displayOrder: 1
  },
  {
    name: 'Early Years: On My Own',
    description: 'Activities for children 0-5 years that allow independent participation',
    ageMin: 0,
    ageMax: 5,
    requiresParent: false,
    displayOrder: 2
  },
  {
    name: 'School Age',
    description: 'Activities for elementary/middle school age children (5-13 years)',
    ageMin: 5,
    ageMax: 13,
    requiresParent: false,
    displayOrder: 3
  },
  {
    name: 'Youth',
    description: 'Activities for teenagers and young adults (10-18 years)',
    ageMin: 10,
    ageMax: 18,
    requiresParent: false,
    displayOrder: 4
  },
  {
    name: 'All Ages & Family',
    description: 'Family-friendly activities suitable for all ages',
    ageMin: null,
    ageMax: null,
    requiresParent: false,
    displayOrder: 5
  }
];

async function seedCategories() {
  console.log('🌱 Seeding categories...');

  try {
    // Insert categories using upsert to handle duplicates
    for (const category of categories) {
      const result = await prisma.category.upsert({
        where: { name: category.name },
        update: {
          description: category.description,
          ageMin: category.ageMin,
          ageMax: category.ageMax,
          requiresParent: category.requiresParent,
          displayOrder: category.displayOrder
        },
        create: category
      });
      console.log(`✅ Category: ${result.name}`);
    }

    console.log('🎉 Categories seeded successfully!');
    
    // Show final count
    const count = await prisma.category.count();
    console.log(`📊 Total categories in database: ${count}`);

  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to categorize activities based on age ranges
async function categorizeActivities() {
  console.log('🏷️ Categorizing existing activities...');

  try {
    // Get all categories
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    // Get all activities with age information
    const activities = await prisma.activity.findMany({
      where: {
        isUpdated: true,
        OR: [
          { ageMin: { not: null } },
          { ageMax: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        ageMin: true,
        ageMax: true
      }
    });

    console.log(`📋 Found ${activities.length} activities with age information`);

    let categorizedCount = 0;

    for (const activity of activities) {
      const applicableCategories = [];

      for (const category of categories) {
        const activityAgeMin = activity.ageMin || 0;
        const activityAgeMax = activity.ageMax || 100;
        
        // Check if activity age range overlaps with category age range
        if (category.name === 'All Ages & Family') {
          // Special case for All Ages & Family - applies to activities with wide age ranges
          if (activityAgeMin <= 6 && activityAgeMax >= 12) {
            applicableCategories.push(category.id);
          }
        } else if (category.ageMin !== null && category.ageMax !== null) {
          // Check for overlap between activity age range and category age range
          const categoryAgeMin = category.ageMin;
          const categoryAgeMax = category.ageMax;
          
          if (activityAgeMin <= categoryAgeMax && activityAgeMax >= categoryAgeMin) {
            applicableCategories.push(category.id);
          }
        }
      }

      // Create ActivityCategory relationships
      for (const categoryId of applicableCategories) {
        try {
          await prisma.activityCategory.upsert({
            where: {
              activityId_categoryId: {
                activityId: activity.id,
                categoryId: categoryId
              }
            },
            update: {},
            create: {
              activityId: activity.id,
              categoryId: categoryId
            }
          });
        } catch (error) {
          // Ignore duplicate key errors
          if (!error.message.includes('unique constraint')) {
            console.error(`Error categorizing activity ${activity.name}:`, error);
          }
        }
      }

      if (applicableCategories.length > 0) {
        categorizedCount++;
      }
    }

    console.log(`🎯 Categorized ${categorizedCount} activities`);

    // Show category statistics
    console.log('\n📊 Category Statistics:');
    for (const category of categories) {
      const count = await prisma.activityCategory.count({
        where: { categoryId: category.id }
      });
      console.log(`   ${category.name}: ${count} activities`);
    }

  } catch (error) {
    console.error('❌ Error categorizing activities:', error);
    process.exit(1);
  }
}

async function main() {
  await seedCategories();
  await categorizeActivities();
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Category seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Category seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedCategories, categorizeActivities };