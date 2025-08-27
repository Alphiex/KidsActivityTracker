const prisma = require('./database/config/database');

async function checkSubcategories() {
  try {
    // Get all unique subcategories
    const subcategories = await prisma.activity.groupBy({
      by: ['subcategory'],
      where: {
        isActive: true,
        subcategory: {
          not: null
        }
      },
      _count: {
        subcategory: true
      }
    });
    
    console.log('All unique subcategories in database:');
    subcategories
      .sort((a, b) => b._count.subcategory - a._count.subcategory)
      .forEach(s => {
        console.log(`  ${s.subcategory}: ${s._count.subcategory}`);
      });
      
    console.log('\n\nTesting exact matches:');
    
    // Test exact matches for consolidated types
    const testTypes = ['Swimming', 'Music', 'Sports', 'Skating'];
    
    for (const type of testTypes) {
      const count = await prisma.activity.count({
        where: {
          isActive: true,
          subcategory: type
        }
      });
      console.log(`  ${type}: ${count} activities`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubcategories();