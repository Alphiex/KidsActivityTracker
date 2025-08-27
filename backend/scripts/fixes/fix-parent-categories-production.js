const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function fixParentCategoriesProduction() {
  try {
    console.log('Starting to fix parent participation categories in production...\n');
    
    // Get categories
    const earlyYearsParentCat = await prisma.category.findUnique({
      where: { code: 'early-years-parent' }
    });
    
    const babyParentCat = await prisma.category.findUnique({
      where: { code: 'baby-parent' }
    });
    
    if (!earlyYearsParentCat || !babyParentCat) {
      console.error('Required categories not found!');
      return;
    }
    
    console.log('Categories found:');
    console.log('  Early Years with Parent:', earlyYearsParentCat.id);
    console.log('  Baby & Parent:', babyParentCat.id);
    
    // Find activities that should be in parent categories based on their category field
    const parentActivities = await prisma.activity.findMany({
      where: {
        isActive: true,
        OR: [
          { category: { contains: 'Parent Participation', mode: 'insensitive' } },
          { subcategory: { contains: 'Parent Participation', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true,
        ageMin: true,
        ageMax: true,
        requiresParent: true
      }
    });
    
    console.log(`\nFound ${parentActivities.length} activities in Parent Participation sections`);
    
    // Clear existing associations for these categories to avoid duplicates
    console.log('\nClearing existing associations...');
    await prisma.activityCategory.deleteMany({
      where: {
        categoryId: { in: [earlyYearsParentCat.id, babyParentCat.id] }
      }
    });
    
    // Create new associations
    const associations = [];
    let babyCount = 0;
    let earlyYearsCount = 0;
    
    for (const activity of parentActivities) {
      // Determine proper age range from activity name
      let actualAgeMin = 0;
      let actualAgeMax = 6;
      
      const name = activity.name.toLowerCase();
      
      // Extract age from name patterns
      if (name.includes('6-18mos') || name.includes('6-18 mos')) {
        actualAgeMin = 0.5;
        actualAgeMax = 1.5;
      } else if (name.includes('18mos-3yrs') || name.includes('18 mos-3 yrs')) {
        actualAgeMin = 1.5;
        actualAgeMax = 3;
      } else if (name.includes('2-4yrs') || name.includes('2-4 yrs')) {
        actualAgeMin = 2;
        actualAgeMax = 4;
      } else if (name.includes('2-3yrs') || name.includes('2-3 yrs')) {
        actualAgeMin = 2;
        actualAgeMax = 3;
      } else if (name.includes('1-5yrs') || name.includes('1-5 yrs')) {
        actualAgeMin = 1;
        actualAgeMax = 5;
      } else if (name.includes('3-12yrs') || name.includes('3-12 yrs')) {
        actualAgeMin = 3;
        actualAgeMax = 12;
      } else if (name.includes('0-6') || name.includes('(0-6)')) {
        actualAgeMin = 0;
        actualAgeMax = 6;
      }
      
      // Baby & Parent (0-1.5 years)
      if (actualAgeMax <= 1.5) {
        associations.push({
          activityId: activity.id,
          categoryId: babyParentCat.id,
          isPrimary: true,
          confidence: 0.95,
          source: 'fix-parent-categories-production'
        });
        babyCount++;
      }
      
      // Early Years with Parent (0-6)
      if (actualAgeMax <= 6 && activity.category?.includes('Parent Participation')) {
        associations.push({
          activityId: activity.id,
          categoryId: earlyYearsParentCat.id,
          isPrimary: actualAgeMax > 1.5,
          confidence: 0.95,
          source: 'fix-parent-categories-production'
        });
        earlyYearsCount++;
      }
    }
    
    // Also find activities with "Parent" in the name but not in Parent Participation category
    const additionalParentActivities = await prisma.activity.findMany({
      where: {
        isActive: true,
        requiresParent: true,
        NOT: {
          category: { contains: 'Parent Participation', mode: 'insensitive' }
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true
      }
    });
    
    console.log(`\nFound ${additionalParentActivities.length} additional activities with requiresParent=true`);
    
    // Add these to early-years-parent if they look like they're for young kids
    for (const activity of additionalParentActivities) {
      const name = activity.name.toLowerCase();
      
      // Check if it's for young kids based on name patterns
      const isForYoungKids = 
        name.includes('tot') ||
        name.includes('toddler') ||
        name.includes('baby') ||
        name.includes('parent') ||
        (name.match(/\d+/) && parseInt(name.match(/\d+/)[0]) <= 6);
      
      if (isForYoungKids) {
        associations.push({
          activityId: activity.id,
          categoryId: earlyYearsParentCat.id,
          isPrimary: true,
          confidence: 0.90,
          source: 'fix-parent-categories-production'
        });
        earlyYearsCount++;
      }
    }
    
    // Create all associations
    if (associations.length > 0) {
      console.log(`\nCreating ${associations.length} category associations...`);
      await prisma.activityCategory.createMany({
        data: associations,
        skipDuplicates: true
      });
    }
    
    console.log('\nCategory assignments created:');
    console.log(`  Baby & Parent (0-1): ${babyCount}`);
    console.log(`  Early Years with Parent (0-6): ${earlyYearsCount}`);
    
    // Verify the fix
    const finalCount = await prisma.activityCategory.count({
      where: { categoryId: earlyYearsParentCat.id }
    });
    
    console.log(`\nFinal count for Early Years with Parent: ${finalCount} activities`);
    
    // Show samples
    const samples = await prisma.activity.findMany({
      where: {
        categories: {
          some: { categoryId: earlyYearsParentCat.id }
        }
      },
      select: {
        name: true,
        category: true,
        requiresParent: true
      },
      take: 5
    });
    
    console.log('\nSample activities in Early Years with Parent:');
    samples.forEach(a => {
      console.log(`  - ${a.name}`);
      console.log(`    Category: ${a.category} | requiresParent: ${a.requiresParent}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixParentCategoriesProduction();