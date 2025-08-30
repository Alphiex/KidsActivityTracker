/**
 * Script to analyze how activities are currently structured in the database
 * to understand where activity type information is stored
 */

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function analyzeActivityStructure() {
  try {
    console.log('Analyzing activity structure in database...\n');
    
    // First, let's search for tennis, badminton, dance, martial arts activities
    const searchTerms = [
      'Tennis', 'Badminton', 'Squash', 'Racquetball',
      'Dance', 'Ballet', 'Jazz', 'Hip Hop',
      'Martial Arts', 'Karate', 'Taekwondo', 'Judo',
      'Basketball', 'Soccer', 'Volleyball',
      'Swimming', 'Swim'
    ];
    
    for (const term of searchTerms) {
      console.log(`\nSearching for "${term}"...`);
      
      // Search in name
      const inName = await prisma.activity.findMany({
        where: {
          name: { contains: term, mode: 'insensitive' },
          isActive: true
        },
        select: {
          name: true,
          category: true,
          subcategory: true,
          activityType: true,
          activitySubtype: true
        },
        take: 3
      });
      
      if (inName.length > 0) {
        const count = await prisma.activity.count({
          where: {
            name: { contains: term, mode: 'insensitive' },
            isActive: true
          }
        });
        console.log(`  Found ${count} activities with "${term}" in name`);
        console.log('  Sample:');
        inName.forEach(a => {
          console.log(`    Name: ${a.name}`);
          console.log(`      Category: ${a.category || 'null'}`);
          console.log(`      Subcategory: ${a.subcategory || 'null'}`);
          console.log(`      ActivityType: ${a.activityType || 'null'}`);
          console.log(`      ActivitySubtype: ${a.activitySubtype || 'null'}`);
        });
      }
      
      // Search in subcategory
      const inSubcategory = await prisma.activity.findMany({
        where: {
          subcategory: { contains: term, mode: 'insensitive' },
          isActive: true
        },
        select: {
          name: true,
          category: true,
          subcategory: true,
          activityType: true,
          activitySubtype: true
        },
        take: 3
      });
      
      if (inSubcategory.length > 0) {
        const count = await prisma.activity.count({
          where: {
            subcategory: { contains: term, mode: 'insensitive' },
            isActive: true
          }
        });
        console.log(`  Found ${count} activities with "${term}" in subcategory`);
        if (inSubcategory[0].subcategory !== inName[0]?.subcategory) {
          console.log('  Sample:');
          inSubcategory.forEach(a => {
            console.log(`    Name: ${a.name}`);
            console.log(`      Subcategory: ${a.subcategory}`);
            console.log(`      ActivityType: ${a.activityType || 'null'}`);
          });
        }
      }
      
      // Search in category
      const inCategory = await prisma.activity.findMany({
        where: {
          category: { contains: term, mode: 'insensitive' },
          isActive: true
        },
        select: {
          name: true,
          category: true,
          subcategory: true,
          activityType: true
        },
        take: 3
      });
      
      if (inCategory.length > 0) {
        const count = await prisma.activity.count({
          where: {
            category: { contains: term, mode: 'insensitive' },
            isActive: true
          }
        });
        console.log(`  Found ${count} activities with "${term}" in category`);
      }
    }
    
    // Now let's see what unique values exist in key fields
    console.log('\n\n=== UNIQUE SUBCATEGORIES (top 50) ===');
    const subcategories = await prisma.activity.groupBy({
      by: ['subcategory'],
      where: {
        subcategory: { not: null },
        isActive: true
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 50
    });
    
    subcategories.forEach(s => {
      console.log(`  "${s.subcategory}": ${s._count.id} activities`);
    });
    
    console.log('\n\n=== UNIQUE CATEGORIES (all) ===');
    const categories = await prisma.activity.groupBy({
      by: ['category'],
      where: {
        category: { not: null },
        isActive: true
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    
    categories.forEach(c => {
      console.log(`  "${c.category}": ${c._count.id} activities`);
    });
    
    console.log('\n\n=== CURRENT ACTIVITY TYPES (all) ===');
    const activityTypes = await prisma.activity.groupBy({
      by: ['activityType'],
      where: {
        activityType: { not: null },
        isActive: true
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    
    activityTypes.forEach(t => {
      console.log(`  "${t.activityType}": ${t._count.id} activities`);
    });
    
  } catch (error) {
    console.error('Error analyzing activities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeActivityStructure();