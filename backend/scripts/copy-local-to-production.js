const { PrismaClient: LocalPrismaClient } = require('../generated/prisma');
const { PrismaClient: ProdPrismaClient } = require('../generated/prisma');

// Create clients for both databases
const localPrisma = new LocalPrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/kids_activity_tracker?schema=public'
    }
  }
});

const prodPrisma = new ProdPrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity'
    }
  }
});

async function copyDataToProduction() {
  console.log('📋 Starting data copy from local to production...\n');
  
  try {
    // 1. Copy Providers
    console.log('Copying providers...');
    const providers = await localPrisma.provider.findMany();
    for (const provider of providers) {
      await prodPrisma.provider.upsert({
        where: { id: provider.id },
        update: provider,
        create: provider
      });
    }
    console.log(`✅ Copied ${providers.length} providers`);
    
    // 2. Copy Locations
    console.log('Copying locations...');
    const locations = await localPrisma.location.findMany();
    for (const location of locations) {
      await prodPrisma.location.upsert({
        where: { id: location.id },
        update: location,
        create: location
      });
    }
    console.log(`✅ Copied ${locations.length} locations`);
    
    // 3. Copy Activities (in batches to avoid timeout) 
    // Remove foreign keys to avoid constraint errors
    console.log('Copying activities...');
    const totalActivities = await localPrisma.activity.count({ where: { isActive: true } });
    const batchSize = 100;
    let copied = 0;
    
    for (let skip = 0; skip < totalActivities; skip += batchSize) {
      const activities = await localPrisma.activity.findMany({
        skip,
        take: batchSize,
        where: { isActive: true }
      });
      
      for (const activity of activities) {
        // Remove foreign key fields that might not match
        const { activityTypeId, activitySubtypeId, ...activityData } = activity;
        
        await prodPrisma.activity.upsert({
          where: { id: activity.id },
          update: activityData,
          create: activityData
        });
        copied++;
      }
      
      console.log(`  Copied ${copied}/${totalActivities} activities...`);
    }
    console.log(`✅ Copied ${copied} activities`);
    
    // 4. Verify the copy
    const prodStats = {
      activities: await prodPrisma.activity.count(),
      providers: await prodPrisma.provider.count(),
      locations: await prodPrisma.location.count(),
      activityTypes: await prodPrisma.activityType.count()
    };
    
    console.log('\n📊 Production database stats:');
    console.log(`  Activities: ${prodStats.activities}`);
    console.log(`  Providers: ${prodStats.providers}`);
    console.log(`  Locations: ${prodStats.locations}`);
    console.log(`  Activity Types: ${prodStats.activityTypes}`);
    
  } catch (error) {
    console.error('❌ Error copying data:', error);
    throw error;
  }
}

copyDataToProduction()
  .then(() => {
    console.log('\n✅ Data successfully copied to production!');
  })
  .catch((error) => {
    console.error('❌ Failed to copy data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  });