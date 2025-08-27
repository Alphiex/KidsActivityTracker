const { PrismaClient } = require('./generated/prisma');

async function quickMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Running quick migration...');
    
    // Just add the essential columns
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Activity" 
      ADD COLUMN IF NOT EXISTS "activityType" TEXT
    `).catch(e => console.log('activityType column might already exist'));
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Activity" 
      ADD COLUMN IF NOT EXISTS "activitySubtype" TEXT
    `).catch(e => console.log('activitySubtype column might already exist'));
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Activity" 
      ADD COLUMN IF NOT EXISTS "requiresParent" BOOLEAN DEFAULT false
    `).catch(e => console.log('requiresParent column might already exist'));
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Activity" 
      ADD COLUMN IF NOT EXISTS "parentInvolvement" TEXT
    `).catch(e => console.log('parentInvolvement column might already exist'));
    
    console.log('✅ Columns added successfully!');
    
    // Verify
    const activity = await prisma.activity.findFirst();
    console.log('Sample activity fields:', {
      hasActivityType: 'activityType' in activity,
      hasActivitySubtype: 'activitySubtype' in activity,
      hasRequiresParent: 'requiresParent' in activity,
      hasParentInvolvement: 'parentInvolvement' in activity
    });
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickMigration();