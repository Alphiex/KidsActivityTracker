const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function fixParentCategories() {
  try {
    console.log('Starting to fix parent participation categories...\n');
    
    // Get categories
    const earlyYearsParentCat = await prisma.category.findUnique({
      where: { code: 'early-years-parent' }
    });
    
    const babyParentCat = await prisma.category.findUnique({
      where: { code: 'baby-parent' }
    });
    
    const earlyYearsSoloCat = await prisma.category.findUnique({
      where: { code: 'early-years-solo' }
    });
    
    if (!earlyYearsParentCat || !babyParentCat || !earlyYearsSoloCat) {
      console.error('Required categories not found!');
      return;
    }
    
    // First, fix activities that should have requiresParent=true based on their category/subcategory
    console.log('Step 1: Setting requiresParent flag for activities with Parent in category/subcategory...');
    
    const parentActivitiesToUpdate = await prisma.activity.findMany({
      where: {
        isActive: true,
        OR: [
          { category: { contains: 'Parent Participation', mode: 'insensitive' } },
          { subcategory: { contains: 'Parent Participation', mode: 'insensitive' } },
          { subcategory: { contains: 'Parent & ', mode: 'insensitive' } },
          { name: { contains: 'Parent & Tot', mode: 'insensitive' } },
          { name: { contains: 'Parent & Child', mode: 'insensitive' } },
          { name: { contains: 'Grandparents & Kids', mode: 'insensitive' } }
        ],
        requiresParent: false
      },
      select: { id: true, name: true, category: true, subcategory: true }
    });
    
    console.log(`Found ${parentActivitiesToUpdate.length} activities that should have requiresParent=true`);
    
    // Update requiresParent flag
    for (const activity of parentActivitiesToUpdate) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: { 
          requiresParent: true,
          parentInvolvement: 'full'
        }
      });
    }
    
    console.log('Updated requiresParent flag\n');
    
    // Step 2: Populate ActivityCategory junction table
    console.log('Step 2: Populating ActivityCategory links...');
    
    // Get activities that need category assignment
    const activitiesToCategorize = await prisma.activity.findMany({
      where: {
        isActive: true,
        ageMax: { lte: 6 }
      },
      select: {
        id: true,
        name: true,
        ageMin: true,
        ageMax: true,
        requiresParent: true,
        category: true,
        subcategory: true
      }
    });
    
    console.log(`Processing ${activitiesToCategorize.length} activities for age 0-6...`);
    
    let babyParentCount = 0;
    let earlyYearsParentCount = 0;
    let earlyYearsSoloCount = 0;
    
    for (const activity of activitiesToCategorize) {
      const categoryAssociations = [];
      
      // Baby & Parent (0-1)
      if (activity.ageMax <= 1) {
        // Check if association already exists
        const exists = await prisma.activityCategory.findFirst({
          where: {
            activityId: activity.id,
            categoryId: babyParentCat.id
          }
        });
        
        if (!exists) {
          categoryAssociations.push({
            activityId: activity.id,
            categoryId: babyParentCat.id,
            isPrimary: true,
            confidence: 0.95,
            source: 'fix-parent-categories'
          });
          babyParentCount++;
        }
      }
      
      // Early Years with Parent (0-6) - if requiresParent is true or has parent keywords
      const hasParentKeywords = 
        activity.category?.toLowerCase().includes('parent') ||
        activity.subcategory?.toLowerCase().includes('parent') ||
        activity.name?.toLowerCase().includes('parent') ||
        activity.name?.toLowerCase().includes(' tot ') ||
        activity.name?.toLowerCase().includes('grandparent');
      
      if (activity.requiresParent || hasParentKeywords) {
        // Check if association already exists
        const exists = await prisma.activityCategory.findFirst({
          where: {
            activityId: activity.id,
            categoryId: earlyYearsParentCat.id
          }
        });
        
        if (!exists) {
          categoryAssociations.push({
            activityId: activity.id,
            categoryId: earlyYearsParentCat.id,
            isPrimary: activity.ageMax <= 1 ? false : true,
            confidence: 0.95,
            source: 'fix-parent-categories'
          });
          earlyYearsParentCount++;
        }
      } else {
        // Early Years Solo (0-6) - for activities without parent
        const exists = await prisma.activityCategory.findFirst({
          where: {
            activityId: activity.id,
            categoryId: earlyYearsSoloCat.id
          }
        });
        
        if (!exists) {
          categoryAssociations.push({
            activityId: activity.id,
            categoryId: earlyYearsSoloCat.id,
            isPrimary: true,
            confidence: 0.95,
            source: 'fix-parent-categories'
          });
          earlyYearsSoloCount++;
        }
      }
      
      // Create associations
      if (categoryAssociations.length > 0) {
        await prisma.activityCategory.createMany({
          data: categoryAssociations,
          skipDuplicates: true
        });
      }
    }
    
    console.log('\nCategory assignments created:');
    console.log(`  Baby & Parent (0-1): ${babyParentCount}`);
    console.log(`  Early Years with Parent (0-6): ${earlyYearsParentCount}`);
    console.log(`  Early Years Solo (0-6): ${earlyYearsSoloCount}`);
    
    // Step 3: Verify the fix
    console.log('\nStep 3: Verifying the fix...');
    
    const earlyYearsParentTotal = await prisma.activityCategory.count({
      where: { categoryId: earlyYearsParentCat.id }
    });
    
    const babyParentTotal = await prisma.activityCategory.count({
      where: { categoryId: babyParentCat.id }
    });
    
    const earlyYearsSoloTotal = await prisma.activityCategory.count({
      where: { categoryId: earlyYearsSoloCat.id }
    });
    
    console.log('\nFinal totals:');
    console.log(`  Baby & Parent (0-1): ${babyParentTotal} activities`);
    console.log(`  Early Years with Parent (0-6): ${earlyYearsParentTotal} activities`);
    console.log(`  Early Years Solo (0-6): ${earlyYearsSoloTotal} activities`);
    
    // Show some samples
    const samples = await prisma.activity.findMany({
      where: {
        categories: {
          some: { categoryId: earlyYearsParentCat.id }
        },
        isActive: true
      },
      select: {
        name: true,
        subcategory: true,
        requiresParent: true
      },
      take: 5
    });
    
    console.log('\nSample activities in Early Years with Parent:');
    samples.forEach(a => {
      console.log(`  - ${a.name}`);
      console.log(`    Subcategory: ${a.subcategory} | requiresParent: ${a.requiresParent}`);
    });
    
  } catch (error) {
    console.error('Error fixing parent categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixParentCategories();