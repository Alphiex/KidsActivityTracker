const { PrismaClient } = require('./generated/prisma');

async function fixActivityCategories() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Fixing activity categories...');
    
    // Map old categories to activity types
    const categoryToType = {
      'Arts': 'Arts & Crafts',
      'Camps': 'Camps', 
      'Fitness': 'Fitness',
      'Swimming': 'Swimming & Aquatics',
      'Sports': 'Sports - Team',
      'Dance': 'Dance',
      'Music': 'Music'
    };
    
    // Update activities with wrong category values
    for (const [oldCategory, newType] of Object.entries(categoryToType)) {
      const result = await prisma.activity.updateMany({
        where: {
          category: oldCategory
        },
        data: {
          activityType: newType,
          category: 'all-ages' // Default to all-ages for now
        }
      });
      
      console.log(`Updated ${result.count} activities from category "${oldCategory}" to type "${newType}"`);
    }
    
    // Fix age-based categories
    await prisma.activity.updateMany({
      where: {
        OR: [
          { category: 'Early Years: Parent Participation' },
          { category: 'Early Years: On My Own' }
        ]
      },
      data: {
        category: 'preschool'
      }
    });
    
    await prisma.activity.updateMany({
      where: {
        category: 'Youth'
      },
      data: {
        category: 'teen'
      }
    });
    
    await prisma.activity.updateMany({
      where: {
        category: 'School Age'
      },
      data: {
        category: 'school-age'
      }
    });
    
    await prisma.activity.updateMany({
      where: {
        category: 'All Ages & Family'
      },
      data: {
        category: 'all-ages'
      }
    });
    
    console.log('Categories fixed!');
    
    // Show summary
    const categorySummary = await prisma.activity.groupBy({
      by: ['category'],
      _count: true
    });
    
    console.log('\nCategory summary:');
    categorySummary.forEach(c => {
      console.log(`  ${c.category}: ${c._count} activities`);
    });
    
    const typeSummary = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: true,
      where: {
        activityType: { not: null }
      }
    });
    
    console.log('\nActivity type summary:');
    typeSummary.forEach(t => {
      console.log(`  ${t.activityType}: ${t._count} activities`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixActivityCategories();