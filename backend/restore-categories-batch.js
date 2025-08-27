const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function restoreCategories() {
  try {
    console.log('Restoring category links for activities...');
    
    // Get all categories
    const categories = await prisma.category.findMany();
    const categoryMap = {};
    categories.forEach(c => {
      categoryMap[c.code] = c.id;
    });
    
    console.log('Categories found:', Object.keys(categoryMap));
    
    // Get all activities without categories
    const activities = await prisma.activity.findMany({
      where: {
        isActive: true,
        categories: {
          none: {}
        }
      },
      select: {
        id: true,
        ageMin: true,
        ageMax: true,
        name: true,
        subcategory: true
      }
    });
    
    console.log(`Found ${activities.length} activities without categories`);
    
    // Prepare batch data
    const links = [];
    
    for (const activity of activities) {
      // Determine category based on age
      let categoryCode = null;
      
      if (!activity.ageMin && !activity.ageMax) {
        categoryCode = 'all-ages';
      } else if (activity.ageMin !== null && activity.ageMin <= 2) {
        // Check if it's a parent & child activity
        const isParentChild = activity.name?.toLowerCase().includes('parent') ||
                            activity.subcategory?.toLowerCase().includes('parent');
        categoryCode = isParentChild ? 'baby-parent' : 'preschool';
      } else if (activity.ageMin !== null && activity.ageMin <= 5) {
        categoryCode = 'preschool';
      } else if (activity.ageMin !== null && activity.ageMin <= 12) {
        categoryCode = 'school-age';
      } else if (activity.ageMin !== null && activity.ageMin >= 13) {
        categoryCode = 'teen';
      } else if (activity.ageMax !== null && activity.ageMax <= 5) {
        categoryCode = 'preschool';
      } else if (activity.ageMax !== null && activity.ageMax <= 12) {
        categoryCode = 'school-age';
      } else {
        categoryCode = 'all-ages';
      }
      
      const categoryId = categoryMap[categoryCode];
      if (categoryId) {
        links.push({
          activityId: activity.id,
          categoryId: categoryId,
          isPrimary: true
        });
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
    
    console.log(`\n✅ Successfully linked activities to categories`);
    
    // Show summary
    const summary = await prisma.category.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });
    
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

restoreCategories();