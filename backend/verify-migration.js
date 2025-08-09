const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('Verifying migration results...\n');
    
    // Check record counts
    const counts = {
      activities: await prisma.activity.count(),
      providers: await prisma.provider.count(),
      locations: await prisma.location.count(),
      users: await prisma.user.count(),
      favorites: await prisma.favorite.count(),
      activityHistory: await prisma.activityHistory.count(),
      scraperRuns: await prisma.scraperRun.count(),
      children: await prisma.child.count(),
      childActivities: await prisma.childActivity.count(),
      activityShares: await prisma.activityShare.count(),
      invitations: await prisma.invitation.count()
    };
    
    console.log('Record counts after migration:');
    console.log('=============================');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`${table.padEnd(20)}: ${count}`);
    });
    
    // Check sample activity
    const sampleActivity = await prisma.activity.findFirst({
      include: { 
        provider: true,
        location: true
      }
    });
    
    if (sampleActivity) {
      console.log('\nSample activity check:');
      console.log('- ID:', sampleActivity.id);
      console.log('- Name:', sampleActivity.name);
      console.log('- Provider:', sampleActivity.provider.name);
      console.log('- External ID:', sampleActivity.externalId);
      console.log('- Category:', sampleActivity.category);
      console.log('- Cost:', sampleActivity.cost);
      console.log('- Age Range:', sampleActivity.ageMin, '-', sampleActivity.ageMax);
      console.log('- Location:', sampleActivity.location?.name || 'N/A');
    }
    
    // Check user data
    const user = await prisma.user.findFirst();
    if (user) {
      console.log('\nUser check:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- Name:', user.name);
      console.log('- Verified:', user.isVerified);
      console.log('- Has password hash:', !!user.passwordHash);
    }
    
    // Verify unique constraints
    console.log('\nVerifying unique constraints...');
    const duplicateCheck = await prisma.$queryRaw`
      SELECT "providerId", "externalId", COUNT(*) as count
      FROM "Activity"
      GROUP BY "providerId", "externalId"
      HAVING COUNT(*) > 1
    `;
    
    if (duplicateCheck.length === 0) {
      console.log('✓ No duplicate activities found (providerId + externalId constraint working)');
    } else {
      console.log('✗ Found duplicate activities:', duplicateCheck);
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();