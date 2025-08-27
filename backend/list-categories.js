require('dotenv').config();
const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function listCategories() {
  console.log('🔍 Fetching all activity categories from database...\n');
  
  try {
    // Get all unique categories with counts
    const categories = await prisma.activity.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    console.log('📊 ACTIVITY CATEGORIES:');
    console.log('=' .repeat(50));
    
    let totalActivities = 0;
    categories.forEach((cat, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${cat.category.padEnd(30)} - ${cat._count.id} activities`);
      totalActivities += cat._count.id;
    });
    
    console.log('=' .repeat(50));
    console.log(`\n📈 Summary:`);
    console.log(`   Total Categories: ${categories.length}`);
    console.log(`   Total Activities: ${totalActivities}`);
    
    // Now get subcategories for each category
    console.log('\n\n📋 DETAILED CATEGORY → SUBCATEGORY BREAKDOWN:');
    console.log('=' .repeat(70));
    
    for (const cat of categories) {
      console.log(`\n🏷️  ${cat.category} (${cat._count.id} activities)`);
      console.log('-'.repeat(50));
      
      // Get subcategories for this category
      const subcategories = await prisma.activity.groupBy({
        by: ['subcategory'],
        where: {
          category: cat.category,
          subcategory: {
            not: null
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        }
      });
      
      if (subcategories.length > 0) {
        subcategories.forEach((subcat, idx) => {
          console.log(`   ${(idx + 1).toString().padStart(2)}. ${(subcat.subcategory || 'N/A').padEnd(40)} - ${subcat._count.id} activities`);
        });
      } else {
        console.log('   No subcategories');
      }
    }
    
    // Get activities with no category
    const noCategoryCount = await prisma.activity.count({
      where: {
        OR: [
          { category: null },
          { category: '' }
        ]
      }
    });
    
    if (noCategoryCount > 0) {
      console.log(`\n⚠️  Activities with no category: ${noCategoryCount}`);
    }
    
    // Get sample activities for each category
    console.log('\n\n📝 SAMPLE ACTIVITIES BY CATEGORY:');
    console.log('=' .repeat(70));
    
    for (const cat of categories.slice(0, 10)) { // Show top 10 categories
      console.log(`\n${cat.category}:`);
      const samples = await prisma.activity.findMany({
        where: {
          category: cat.category
        },
        select: {
          name: true,
          subcategory: true,
          ageMin: true,
          ageMax: true,
          cost: true
        },
        take: 3
      });
      
      samples.forEach(sample => {
        console.log(`  • ${sample.name}`);
        console.log(`    Subcategory: ${sample.subcategory || 'N/A'} | Ages: ${sample.ageMin || '?'}-${sample.ageMax || '?'} | Cost: $${sample.cost}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listCategories();
