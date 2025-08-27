const { PrismaClient } = require('./generated/prisma');

async function fixAllCategories() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Fixing all remaining incorrect categories...\n');
    
    // Map all non-age categories to activity types
    const categoryToType = {
      'Martial Arts': 'Martial Arts',
      'Racquet Sports': 'Sports - Individual',
      'Team Sports': 'Sports - Team',
      'Visual Arts': 'Arts & Crafts',
      'Aquatic Leadership': 'Swimming & Aquatics',
      'Certifications and Leadership': 'Educational',
      'Learn and Play': 'Educational',
      'Spin': 'Fitness',
      'Strength & Cardio': 'Fitness',
      'Yoga': 'Fitness'
    };
    
    // First, update all activities with these categories
    for (const [oldCategory, newType] of Object.entries(categoryToType)) {
      const result = await prisma.activity.updateMany({
        where: {
          category: oldCategory
        },
        data: {
          activityType: newType,
          category: 'all-ages' // Default to all-ages, will be refined based on age
        }
      });
      
      if (result.count > 0) {
        console.log(`Updated ${result.count} activities from category "${oldCategory}" to type "${newType}"`);
      }
    }
    
    // Now set proper age-based categories based on ageMin/ageMax
    console.log('\nSetting age-based categories...');
    
    // Baby & Parent (0-1 years)
    await prisma.activity.updateMany({
      where: {
        ageMax: { lte: 1 },
        ageMin: { gte: 0 }
      },
      data: {
        category: 'baby-parent',
        requiresParent: true
      }
    });
    
    // Preschool (2-4 years)
    await prisma.activity.updateMany({
      where: {
        ageMin: { gte: 2 },
        ageMax: { lte: 4 }
      },
      data: {
        category: 'preschool'
      }
    });
    
    // School Age (5-13 years)
    await prisma.activity.updateMany({
      where: {
        ageMin: { gte: 5 },
        ageMax: { lte: 13 }
      },
      data: {
        category: 'school-age'
      }
    });
    
    // Teen (14-18 years)
    await prisma.activity.updateMany({
      where: {
        ageMin: { gte: 14 },
        ageMax: { lte: 18 }
      },
      data: {
        category: 'teen'
      }
    });
    
    // Activities spanning multiple age groups or without specific ages -> all-ages
    await prisma.activity.updateMany({
      where: {
        OR: [
          { ageMin: null },
          { ageMax: null },
          { 
            AND: [
              { ageMin: { lte: 5 } },
              { ageMax: { gte: 13 } }
            ]
          }
        ]
      },
      data: {
        category: 'all-ages'
      }
    });
    
    // Ensure all activities have an activity type if they have a subcategory
    const subcategoryToType = {
      'Swimming': 'Swimming & Aquatics',
      'Basketball': 'Sports - Team',
      'Soccer': 'Sports - Team',
      'Hockey': 'Ice Sports',
      'Tennis': 'Sports - Individual',
      'Golf': 'Sports - Individual',
      'Dance': 'Dance',
      'Ballet': 'Dance',
      'Music': 'Music',
      'Piano': 'Music',
      'Guitar': 'Music',
      'Art': 'Arts & Crafts',
      'Painting': 'Arts & Crafts',
      'Drawing': 'Arts & Crafts',
      'Gymnastics': 'Gymnastics',
      'Skating': 'Ice Sports',
      'Karate': 'Martial Arts',
      'Taekwondo': 'Martial Arts',
      'Judo': 'Martial Arts'
    };
    
    for (const [subcategory, type] of Object.entries(subcategoryToType)) {
      await prisma.activity.updateMany({
        where: {
          subcategory: { contains: subcategory },
          activityType: null
        },
        data: {
          activityType: type
        }
      });
    }
    
    console.log('\nCategories fixed!');
    
    // Show final summary
    const categorySummary = await prisma.activity.groupBy({
      by: ['category'],
      _count: true,
      orderBy: {
        _count: {
          _count: 'desc'
        }
      }
    });
    
    console.log('\n=== Final Category Summary ===');
    let totalCategorized = 0;
    categorySummary.forEach(c => {
      console.log(`  ${c.category || 'null'}: ${c._count} activities`);
      if (['baby-parent', 'preschool', 'school-age', 'teen', 'all-ages'].includes(c.category)) {
        totalCategorized += c._count;
      }
    });
    console.log(`\nTotal properly categorized: ${totalCategorized}`);
    
    const typeSummary = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: true,
      where: {
        activityType: { not: null }
      },
      orderBy: {
        _count: {
          _count: 'desc'
        }
      }
    });
    
    console.log('\n=== Activity Type Summary ===');
    typeSummary.forEach(t => {
      console.log(`  ${t.activityType}: ${t._count} activities`);
    });
    
    // Check for any remaining problematic categories
    const problematicCategories = await prisma.activity.groupBy({
      by: ['category'],
      _count: true,
      where: {
        NOT: {
          category: {
            in: ['baby-parent', 'preschool', 'school-age', 'teen', 'all-ages']
          }
        }
      }
    });
    
    if (problematicCategories.length > 0) {
      console.log('\n⚠️  Remaining non-standard categories:');
      problematicCategories.forEach(c => {
        console.log(`  ${c.category}: ${c._count} activities`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllCategories();