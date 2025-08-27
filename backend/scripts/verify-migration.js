require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('🔍 Verifying Migration Results\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Check overall migration status
    const totalActivities = await prisma.activity.count();
    const mappedActivities = await prisma.activity.count({
      where: { activityType: { not: null } }
    });
    const unmappedActivities = await prisma.activity.count({
      where: { activityType: null }
    });
    
    console.log('📊 ACTIVITY MAPPING STATUS:');
    console.log(`   Total Activities: ${totalActivities}`);
    console.log(`   Mapped Activities: ${mappedActivities} (${(mappedActivities/totalActivities*100).toFixed(1)}%)`);
    console.log(`   Unmapped Activities: ${unmappedActivities} (${(unmappedActivities/totalActivities*100).toFixed(1)}%)`);
    
    // 2. Check parent participation detection
    console.log('\n👨‍👩‍👧 PARENT PARTICIPATION:');
    const parentRequired = await prisma.activity.count({
      where: { requiresParent: true }
    });
    console.log(`   Activities requiring parent: ${parentRequired}`);
    
    // Check infant rule (ages 1 and under MUST have parent)
    const infantActivities = await prisma.activity.findMany({
      where: {
        OR: [
          { ageMin: { lte: 1 } },
          { ageMax: { lte: 1 } }
        ]
      },
      select: {
        id: true,
        name: true,
        ageMin: true,
        ageMax: true,
        requiresParent: true
      }
    });
    
    const infantsWithoutParent = infantActivities.filter(a => !a.requiresParent);
    console.log(`   Infant activities (≤1 year): ${infantActivities.length}`);
    if (infantsWithoutParent.length > 0) {
      console.log(`   ⚠️  RULE VIOLATION: ${infantsWithoutParent.length} infant activities without parent flag!`);
      console.log('   First 5 violations:');
      infantsWithoutParent.slice(0, 5).forEach(a => {
        console.log(`     - ${a.name} (Ages ${a.ageMin}-${a.ageMax})`);
      });
    } else {
      console.log(`   ✅ All infant activities correctly require parent`);
    }
    
    // 3. Check category assignments
    console.log('\n📁 CATEGORY ASSIGNMENTS:');
    const categoryStats = await prisma.activityCategory.groupBy({
      by: ['categoryId'],
      _count: true
    });
    
    for (const stat of categoryStats) {
      const category = await prisma.category.findUnique({
        where: { id: stat.categoryId }
      });
      console.log(`   ${category.name}: ${stat._count} activities`);
    }
    
    // Check activities with multiple categories
    const multiCategoryActivities = await prisma.activityCategory.groupBy({
      by: ['activityId'],
      _count: true,
      having: {
        activityId: {
          _count: { gt: 1 }
        }
      }
    });
    console.log(`   Activities with multiple categories: ${multiCategoryActivities.length}`);
    
    // 4. Check activity type distribution
    console.log('\n🏃 ACTIVITY TYPE DISTRIBUTION:');
    const typeDistribution = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });
    
    typeDistribution.forEach(type => {
      const percentage = (type._count.id/totalActivities*100).toFixed(1);
      console.log(`   ${type.activityType || 'Not Set'}: ${type._count.id} (${percentage}%)`);
    });
    
    // 5. Check unmapped activities needing review
    console.log('\n⚠️  UNMAPPED ACTIVITIES FOR REVIEW:');
    const unmappedForReview = await prisma.unmappedActivity.count({
      where: { reviewed: false }
    });
    console.log(`   Total needing review: ${unmappedForReview}`);
    
    if (unmappedForReview > 0) {
      const samples = await prisma.unmappedActivity.findMany({
        where: { reviewed: false },
        take: 10
      });
      
      console.log('   Sample unmapped categories:');
      const uniqueCategories = [...new Set(samples.map(s => 
        `${s.originalCategory || 'null'}/${s.originalSubcategory || 'null'}`
      ))];
      uniqueCategories.forEach(cat => {
        console.log(`     - ${cat}`);
      });
    }
    
    // 6. Check for data integrity issues
    console.log('\n🔧 DATA INTEGRITY CHECKS:');
    
    // Activities without any category
    const noCategoryCount = await prisma.activity.count({
      where: {
        categories: { none: {} }
      }
    });
    console.log(`   Activities without categories: ${noCategoryCount}`);
    
    // Activities with conflicting parent requirements
    const parentConflicts = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Activity" a
      JOIN "ActivityCategory" ac ON a.id = ac."activityId"
      JOIN "Category" c ON ac."categoryId" = c.id
      WHERE (a."requiresParent" = true AND c."requiresParent" = false)
         OR (a."requiresParent" = false AND c."requiresParent" = true AND a."ageMin" <= 1)
    `;
    console.log(`   Parent requirement conflicts: ${parentConflicts[0]?.count || 0}`);
    
    // 7. Sample activities with full mapping
    console.log('\n📋 SAMPLE FULLY MAPPED ACTIVITIES:');
    const sampleMapped = await prisma.activity.findMany({
      where: {
        activityType: { not: null },
        categories: { some: {} }
      },
      take: 5,
      include: {
        categories: {
          include: { category: true }
        }
      }
    });
    
    sampleMapped.forEach(activity => {
      console.log(`\n   ${activity.name}`);
      console.log(`     Type: ${activity.activityType} / ${activity.activitySubtype || 'N/A'}`);
      console.log(`     Ages: ${activity.ageMin || '?'}-${activity.ageMax || '?'}`);
      console.log(`     Parent Required: ${activity.requiresParent ? 'Yes' : 'No'}`);
      console.log(`     Categories: ${activity.categories.map(c => c.category.name).join(', ')}`);
    });
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION VERIFICATION COMPLETE\n');
    
    const issues = [];
    if (unmappedActivities > 0) issues.push(`${unmappedActivities} unmapped activities`);
    if (infantsWithoutParent.length > 0) issues.push(`${infantsWithoutParent.length} infant rule violations`);
    if (noCategoryCount > 0) issues.push(`${noCategoryCount} activities without categories`);
    if (parentConflicts[0]?.count > 0) issues.push(`${parentConflicts[0].count} parent conflicts`);
    
    if (issues.length > 0) {
      console.log('⚠️  Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('🎉 All checks passed successfully!');
    }
    
  } catch (error) {
    console.error('Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });