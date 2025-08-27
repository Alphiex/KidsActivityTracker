const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function updateCategories() {
  try {
    console.log('Updating categories to correct specification...');
    
    // Delete existing categories
    await prisma.activityCategory.deleteMany({});
    await prisma.category.deleteMany({});
    
    // Create the correct categories
    const categories = [
      {
        code: 'school-age',
        name: 'School Age (5-13)',
        description: 'Activities for kids between 5-13 years old',
        displayOrder: 1,
        ageMin: 5,
        ageMax: 13,
        requiresParent: false
      },
      {
        code: 'youth',
        name: 'Youth (10-18)',
        description: 'Activities for youth between 10-18 years old',
        displayOrder: 2,
        ageMin: 10,
        ageMax: 18,
        requiresParent: false
      },
      {
        code: 'baby-parent',
        name: 'Baby and Parent (0-1)',
        description: 'Activities for babies (0-1 year) with parent participation',
        displayOrder: 3,
        ageMin: 0,
        ageMax: 1,
        requiresParent: true
      },
      {
        code: 'early-years-solo',
        name: 'Early Years Solo (0-6)',
        description: 'Activities for kids between 0-6 years old by themselves',
        displayOrder: 4,
        ageMin: 0,
        ageMax: 6,
        requiresParent: false
      },
      {
        code: 'early-years-parent',
        name: 'Early Years with Parent (0-6)',
        description: 'Activities for kids between 0-6 years old with parent participation',
        displayOrder: 5,
        ageMin: 0,
        ageMax: 6,
        requiresParent: true
      }
    ];
    
    // Create categories
    for (const cat of categories) {
      await prisma.category.create({
        data: cat
      });
      console.log(`Created category: ${cat.name}`);
    }
    
    console.log('\n✅ Categories updated successfully!');
    
    // Now assign activities to categories
    console.log('\nAssigning activities to categories...');
    
    const categoriesMap = {};
    const allCategories = await prisma.category.findMany();
    allCategories.forEach(c => {
      categoriesMap[c.code] = c.id;
    });
    
    const activities = await prisma.activity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        ageMin: true,
        ageMax: true,
        name: true,
        subcategory: true,
        requiresParent: true
      }
    });
    
    console.log(`Processing ${activities.length} activities...`);
    
    const links = [];
    
    for (const activity of activities) {
      const categoryIds = new Set();
      
      // Check if activity requires parent participation
      const requiresParent = activity.requiresParent || 
                           activity.name?.toLowerCase().includes('parent') ||
                           activity.subcategory?.toLowerCase().includes('parent');
      
      // Baby and Parent (0-1)
      if (activity.ageMin !== null && activity.ageMin <= 1 && requiresParent) {
        categoryIds.add(categoriesMap['baby-parent']);
      }
      
      // Early Years Solo (0-6)
      if (!requiresParent) {
        if ((activity.ageMin !== null && activity.ageMin <= 6) ||
            (activity.ageMax !== null && activity.ageMax >= 0 && activity.ageMax <= 6)) {
          categoryIds.add(categoriesMap['early-years-solo']);
        }
      }
      
      // Early Years with Parent (0-6)
      if (requiresParent) {
        if ((activity.ageMin !== null && activity.ageMin <= 6) ||
            (activity.ageMax !== null && activity.ageMax >= 0 && activity.ageMax <= 6)) {
          categoryIds.add(categoriesMap['early-years-parent']);
        }
      }
      
      // School Age (5-13)
      if ((activity.ageMin !== null && activity.ageMin <= 13 && (activity.ageMax === null || activity.ageMax >= 5)) ||
          (activity.ageMax !== null && activity.ageMax >= 5 && activity.ageMax <= 13) ||
          (activity.ageMin !== null && activity.ageMin >= 5 && activity.ageMin <= 13)) {
        categoryIds.add(categoriesMap['school-age']);
      }
      
      // Youth (10-18)
      if ((activity.ageMin !== null && activity.ageMin <= 18 && (activity.ageMax === null || activity.ageMax >= 10)) ||
          (activity.ageMax !== null && activity.ageMax >= 10 && activity.ageMax <= 18) ||
          (activity.ageMin !== null && activity.ageMin >= 10 && activity.ageMin <= 18)) {
        categoryIds.add(categoriesMap['youth']);
      }
      
      // If no category matched and age ranges are available, make best guess
      if (categoryIds.size === 0) {
        if (activity.ageMin !== null || activity.ageMax !== null) {
          const avgAge = ((activity.ageMin || 0) + (activity.ageMax || 18)) / 2;
          if (avgAge <= 1 && requiresParent) {
            categoryIds.add(categoriesMap['baby-parent']);
          } else if (avgAge <= 6) {
            categoryIds.add(requiresParent ? categoriesMap['early-years-parent'] : categoriesMap['early-years-solo']);
          } else if (avgAge <= 13) {
            categoryIds.add(categoriesMap['school-age']);
          } else {
            categoryIds.add(categoriesMap['youth']);
          }
        }
      }
      
      // Create links for each category
      for (const categoryId of categoryIds) {
        if (categoryId) {
          links.push({
            activityId: activity.id,
            categoryId: categoryId,
            isPrimary: categoryIds.size === 1,
            confidence: 1.0,
            source: 'age-based'
          });
        }
      }
    }
    
    console.log(`Creating ${links.length} category links...`);
    
    // Create links in batches
    const batchSize = 100;
    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize);
      await prisma.activityCategory.createMany({
        data: batch,
        skipDuplicates: true
      });
      console.log(`  Created ${Math.min(i + batchSize, links.length)}/${links.length} links...`);
    }
    
    // Show summary
    const summary = await prisma.category.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });
    
    console.log('\n✅ Category assignment complete!');
    console.log('\nCategory summary:');
    summary.forEach(c => {
      console.log(`  ${c.name}: ${c._count.activities} activities`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCategories();