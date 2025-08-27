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
    
    // Get all activities
    const activities = await prisma.activity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        ageMin: true,
        ageMax: true,
        name: true,
        subcategory: true
      }
    });
    
    console.log(`Processing ${activities.length} activities...`);
    
    let linked = 0;
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
        try {
          // Check if link already exists
          const existing = await prisma.activityCategory.findFirst({
            where: {
              activityId: activity.id,
              categoryId: categoryId
            }
          });
          
          if (!existing) {
            await prisma.activityCategory.create({
              data: {
                activityId: activity.id,
                categoryId: categoryId,
                isPrimary: true
              }
            });
            linked++;
            
            if (linked % 100 === 0) {
              console.log(`  Linked ${linked} activities...`);
            }
          }
        } catch (err) {
          // Ignore duplicate errors
        }
      }
    }
    
    console.log(`\n✅ Successfully linked ${linked} activities to categories`);
    
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