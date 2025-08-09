require('dotenv').config({ path: '.env.production' });
const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function extractAllActivityTypes() {
  console.log('Connecting to database...');
  console.log('Database URL:', process.env.DATABASE_URL ? 'Connected' : 'Not found');
  
  try {
    // Get total count of activities
    const totalActivities = await prisma.activity.count();
    console.log(`\nTotal activities in database: ${totalActivities}`);
    
    // Get count of active activities
    const activeActivities = await prisma.activity.count({
      where: { isActive: true }
    });
    console.log(`Active activities: ${activeActivities}`);
    
    // Extract all unique categories
    console.log('\n=== EXTRACTING UNIQUE CATEGORIES ===');
    const categories = await prisma.activity.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' }
    });
    
    console.log(`\nFound ${categories.length} unique categories:`);
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.category}`);
    });
    
    // Extract all unique subcategories grouped by category
    console.log('\n=== EXTRACTING CATEGORIES WITH SUBCATEGORIES ===');
    const categoriesWithSubcategories = await prisma.activity.groupBy({
      by: ['category', 'subcategory'],
      orderBy: [
        { category: 'asc' },
        { subcategory: 'asc' }
      ]
    });
    
    // Organize by category
    const categoryMap = {};
    categoriesWithSubcategories.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = new Set();
      }
      if (item.subcategory) {
        categoryMap[item.category].add(item.subcategory);
      }
    });
    
    console.log('\nCategories with their subcategories:');
    Object.keys(categoryMap).sort().forEach(category => {
      console.log(`\n${category}:`);
      const subcategories = Array.from(categoryMap[category]).sort();
      if (subcategories.length > 0) {
        subcategories.forEach(sub => {
          console.log(`  - ${sub}`);
        });
      } else {
        console.log('  (No subcategories)');
      }
    });
    
    // Get activity count by category
    console.log('\n=== ACTIVITY COUNT BY CATEGORY ===');
    const activityCountByCategory = await prisma.activity.groupBy({
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
    
    console.log('\nActivity distribution:');
    activityCountByCategory.forEach(item => {
      console.log(`${item.category}: ${item._count.id} activities`);
    });
    
    // Get all unique activity names
    console.log('\n=== EXTRACTING ALL UNIQUE ACTIVITY NAMES ===');
    const uniqueActivities = await prisma.activity.findMany({
      distinct: ['name'],
      select: {
        name: true,
        category: true,
        subcategory: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });
    
    console.log(`\nFound ${uniqueActivities.length} unique activity names`);
    
    // Create comprehensive report
    const report = {
      extractionDate: new Date().toISOString(),
      totalActivities,
      activeActivities,
      uniqueCategories: categories.map(c => c.category),
      categoriesWithSubcategories: Object.keys(categoryMap).sort().map(category => ({
        category,
        subcategories: Array.from(categoryMap[category]).sort()
      })),
      activityCountByCategory: activityCountByCategory.map(item => ({
        category: item.category,
        count: item._count.id
      })),
      uniqueActivityNames: uniqueActivities.map(a => ({
        name: a.name,
        category: a.category,
        subcategory: a.subcategory || null
      }))
    };
    
    // Save to file
    const fs = require('fs');
    const filename = `activity-types-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\nFull report saved to: ${filename}`);
    
    // Also save a simplified list
    const simplifiedList = {
      categories: Object.keys(categoryMap).sort(),
      categorySubcategoryPairs: []
    };
    
    Object.keys(categoryMap).sort().forEach(category => {
      const subcategories = Array.from(categoryMap[category]).sort();
      if (subcategories.length > 0) {
        subcategories.forEach(sub => {
          simplifiedList.categorySubcategoryPairs.push({
            category,
            subcategory: sub
          });
        });
      } else {
        simplifiedList.categorySubcategoryPairs.push({
          category,
          subcategory: null
        });
      }
    });
    
    const simpleFilename = `activity-categories-simple-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(simpleFilename, JSON.stringify(simplifiedList, null, 2));
    console.log(`Simplified list saved to: ${simpleFilename}`);
    
    // Get some sample activities for each category
    console.log('\n=== SAMPLE ACTIVITIES BY CATEGORY ===');
    for (const category of categories.slice(0, 5)) { // Show first 5 categories
      console.log(`\n${category.category}:`);
      const samples = await prisma.activity.findMany({
        where: { 
          category: category.category,
          isActive: true
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
        console.log(`  - ${sample.name}`);
        if (sample.subcategory) console.log(`    Subcategory: ${sample.subcategory}`);
        console.log(`    Age: ${sample.ageMin || 0}-${sample.ageMax || 18}, Cost: $${sample.cost || 0}`);
      });
    }
    
  } catch (error) {
    console.error('Error extracting activity types:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the extraction
extractAllActivityTypes();