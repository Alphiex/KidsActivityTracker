const { PrismaClient } = require('../generated/prisma');
const activities = require('../activities-export.json');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function importActivities() {
  try {
    console.log(`Importing ${activities.length} activities...`);
    
    // Get the NVRC provider ID from cloud database
    const nvrcProvider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!nvrcProvider) {
      throw new Error('NVRC provider not found in cloud database');
    }
    
    console.log(`Using cloud provider ID: ${nvrcProvider.id}`);
    
    for (const activity of activities) {
      // Extract the data we need
      const { 
        id, 
        provider, 
        location, 
        createdAt, 
        updatedAt, 
        lastSeenAt,
        ...activityData 
      } = activity;
      
      try {
        // Use cloud provider ID
        activityData.providerId = nvrcProvider.id;
        
        // Handle location if exists
        if (location && activityData.locationId) {
          const cloudLocation = await prisma.location.upsert({
            where: {
              name_address: {
                name: location.name,
                address: location.address || ''
              }
            },
            update: {},
            create: {
              name: location.name,
              address: location.address || '',
              city: location.city || 'North Vancouver',
              province: location.province || 'BC',
              postalCode: location.postalCode,
              latitude: location.latitude,
              longitude: location.longitude,
              facility: location.facility
            }
          });
          activityData.locationId = cloudLocation.id;
        }
        
        // Upsert the activity
        await prisma.activity.upsert({
          where: { 
            providerId_externalId: {
              providerId: activityData.providerId,
              externalId: activityData.externalId
            }
          },
          update: {
            ...activityData,
            lastSeenAt: new Date(lastSeenAt)
          },
          create: {
            ...activityData,
            lastSeenAt: new Date(lastSeenAt)
          }
        });
        
        console.log(`✓ Imported activity: ${activityData.name}`);
      } catch (error) {
        console.error(`✗ Failed to import activity ${activityData.name}:`, error.message);
      }
    }
    
    console.log('\nImport complete!');
    
    // Verify the import
    const count = await prisma.activity.count();
    console.log(`Total activities in database: ${count}`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  console.error('Please provide DATABASE_URL environment variable');
  process.exit(1);
}

importActivities();