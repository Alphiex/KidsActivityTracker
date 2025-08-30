const { PrismaClient } = require('./generated/prisma');

/**
 * Verify the results of the multi-provider scraper architecture
 */
async function verifyScraperResults() {
  const prisma = new PrismaClient();
  
  console.log('📊 Multi-Provider Scraper Results Verification');
  console.log('==============================================\n');
  
  try {
    // 1. Provider Summary
    console.log('📋 Provider Summary:');
    console.log('--------------------');
    
    const providers = await prisma.provider.findMany({
      select: {
        id: true,
        name: true,
        platform: true,
        region: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { 
            activities: true,
            scrapeJobs: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    providers.forEach(provider => {
      console.log(`\n✅ ${provider.name}`);
      console.log(`   ID: ${provider.id}`);
      console.log(`   Platform: ${provider.platform || 'Not set'}`);
      console.log(`   Region: ${provider.region || 'Not set'}`);
      console.log(`   Status: ${provider.isActive ? 'Active' : 'Inactive'}`);
      console.log(`   Activities: ${provider._count.activities}`);
      console.log(`   Scrape Jobs: ${provider._count.scrapeJobs}`);
      console.log(`   Created: ${provider.createdAt.toLocaleString()}`);
      console.log(`   Updated: ${provider.updatedAt.toLocaleString()}`);
    });
    
    // 2. Activity Statistics
    console.log('\n\n📋 Activity Statistics:');
    console.log('-----------------------');
    
    const totalActivities = await prisma.activity.count();
    const activeActivities = await prisma.activity.count({ where: { isActive: true } });
    const recentActivities = await prisma.activity.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });
    
    console.log(`   Total Activities: ${totalActivities}`);
    console.log(`   Active Activities: ${activeActivities}`);
    console.log(`   Activities Added Today: ${recentActivities}`);
    
    // 3. Activities by Provider
    console.log('\n📋 Activities by Provider:');
    console.log('-------------------------');
    
    for (const provider of providers) {
      const categories = await prisma.activity.groupBy({
        by: ['category'],
        where: { 
          providerId: provider.id,
          isActive: true
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      });
      
      if (categories.length > 0) {
        console.log(`\n${provider.name}:`);
        categories.forEach(cat => {
          console.log(`   ${cat.category || 'Uncategorized'}: ${cat._count.id} activities`);
        });
      }
    }
    
    // 4. Recent Sample Activities
    console.log('\n\n📋 Recent Sample Activities:');
    console.log('----------------------------');
    
    const recentSamples = await prisma.activity.findMany({
      where: { isActive: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        category: true,
        subcategory: true,
        cost: true,
        ageMin: true,
        ageMax: true,
        locationName: true,
        provider: {
          select: { name: true }
        },
        createdAt: true
      }
    });
    
    recentSamples.forEach((activity, idx) => {
      console.log(`\n${idx + 1}. ${activity.name}`);
      console.log(`   Provider: ${activity.provider.name}`);
      console.log(`   Category: ${activity.category || 'N/A'} | Subcategory: ${activity.subcategory || 'N/A'}`);
      console.log(`   Cost: $${activity.cost || 0}`);
      console.log(`   Age Range: ${activity.ageMin || '?'} - ${activity.ageMax || '?'}`);
      console.log(`   Location: ${activity.locationName || 'N/A'}`);
      console.log(`   Added: ${activity.createdAt.toLocaleString()}`);
    });
    
    // 5. Data Quality Check
    console.log('\n\n📋 Data Quality Check:');
    console.log('----------------------');
    
    const missingCost = await prisma.activity.count({
      where: { 
        isActive: true,
        OR: [
          { cost: null },
          { cost: 0 }
        ]
      }
    });
    
    const missingLocation = await prisma.activity.count({
      where: {
        isActive: true,
        locationName: null
      }
    });
    
    const missingAgeRange = await prisma.activity.count({
      where: {
        isActive: true,
        OR: [
          { ageMin: null },
          { ageMax: null }
        ]
      }
    });
    
    const totalActive = await prisma.activity.count({ where: { isActive: true } });
    
    console.log(`   Activities missing cost: ${missingCost} (${(missingCost/totalActive*100).toFixed(1)}%)`);
    console.log(`   Activities missing location: ${missingLocation} (${(missingLocation/totalActive*100).toFixed(1)}%)`);
    console.log(`   Activities missing age range: ${missingAgeRange} (${(missingAgeRange/totalActive*100).toFixed(1)}%)`);
    
    const dataQualityScore = (1 - ((missingCost + missingLocation + missingAgeRange) / (totalActive * 3))) * 100;
    console.log(`\n   📊 Overall Data Quality Score: ${dataQualityScore.toFixed(1)}%`);
    
    // 6. Architecture Validation
    console.log('\n\n🎯 Architecture Validation:');
    console.log('---------------------------');
    
    const hasMultipleProviders = providers.length > 1;
    const hasMultiplePlatforms = [...new Set(providers.map(p => p.platform).filter(p => p))].length > 1;
    const hasActivities = totalActivities > 0;
    const hasRecentActivity = recentActivities > 0;
    
    console.log(`   ✅ Multiple providers configured: ${hasMultipleProviders ? 'Yes' : 'No'} (${providers.length} providers)`);
    console.log(`   ✅ Multiple platforms supported: ${hasMultiplePlatforms ? 'Yes' : 'No'}`);
    console.log(`   ✅ Activities stored: ${hasActivities ? 'Yes' : 'No'} (${totalActivities} total)`);
    console.log(`   ✅ Recent scraping activity: ${hasRecentActivity ? 'Yes' : 'No'} (${recentActivities} today)`);
    
    // Summary
    console.log('\n\n🎉 Verification Complete!');
    console.log('========================');
    console.log('\n📊 Summary:');
    console.log(`   Providers: ${providers.length}`);
    console.log(`   Total Activities: ${totalActivities}`);
    console.log(`   Data Quality: ${dataQualityScore.toFixed(1)}%`);
    console.log(`   Status: ${hasMultipleProviders && hasActivities ? '✅ Operational' : '⚠️ Needs Configuration'}`);
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
if (require.main === module) {
  verifyScraperResults()
    .then(() => {
      console.log('\n✅ Verification completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyScraperResults };