const { PrismaClient } = require('./generated/prisma');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    // Count total activities
    const totalActivities = await prisma.activity.count();
    const activeActivities = await prisma.activity.count({
      where: { isActive: true }
    });
    
    console.log('=== DATABASE SUMMARY ===');
    console.log(`Total activities: ${totalActivities}`);
    console.log(`Active activities: ${activeActivities}`);
    console.log(`Inactive activities: ${totalActivities - activeActivities}`);
    
    // Get activities by provider
    const nvrcActivities = await prisma.activity.count({
      where: { 
        provider: { name: 'NVRC' },
        isActive: true
      }
    });
    
    console.log(`\nNVRC active activities: ${nvrcActivities}`);
    
    // Get summary by section
    const bySection = await prisma.activity.groupBy({
      by: ['category'],
      where: { 
        provider: { name: 'NVRC' },
        isActive: true
      },
      _count: true
    });
    
    console.log('\n=== ACTIVITIES BY SECTION ===');
    bySection.forEach(section => {
      console.log(`${section.category}: ${section._count}`);
    });
    
    // Get recent activities
    const recentActivities = await prisma.activity.findMany({
      where: { 
        provider: { name: 'NVRC' },
        isActive: true
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        category: true,
        subcategory: true,
        schedule: true,
        cost: true,
        ageMin: true,
        ageMax: true,
        createdAt: true
      }
    });
    
    console.log('\n=== SAMPLE RECENT ACTIVITIES ===');
    recentActivities.forEach(activity => {
      console.log(`\n${activity.name}`);
      console.log(`  Category: ${activity.category} / ${activity.subcategory}`);
      console.log(`  Schedule: ${activity.schedule}`);
      console.log(`  Age: ${activity.ageMin}-${activity.ageMax} years`);
      console.log(`  Cost: $${activity.cost}`);
      console.log(`  Created: ${activity.createdAt.toISOString()}`);
    });
    
    // Get last scrape job
    const lastScrapeJob = await prisma.scrapeJob.findFirst({
      where: { provider: { name: 'NVRC' } },
      orderBy: { createdAt: 'desc' }
    });
    
    if (lastScrapeJob) {
      console.log('\n=== LAST SCRAPE JOB ===');
      console.log(`Status: ${lastScrapeJob.status}`);
      console.log(`Started: ${lastScrapeJob.startedAt?.toISOString()}`);
      console.log(`Completed: ${lastScrapeJob.completedAt?.toISOString()}`);
      console.log(`Activities found: ${lastScrapeJob.activitiesFound}`);
      console.log(`Created: ${lastScrapeJob.activitiesCreated}`);
      console.log(`Updated: ${lastScrapeJob.activitiesUpdated}`);
      console.log(`Removed: ${lastScrapeJob.activitiesRemoved}`);
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();