require('dotenv').config({ path: '.env.production' });

const { PrismaClient } = require('../generated/prisma');

async function runMigration() {
  const prisma = new PrismaClient();
  
  console.log('🚀 Running activity fields migration...\n');
  
  try {
    // Check existing columns
    const existingColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'Activity'
        AND column_name IN (
          'registrationEndDate', 
          'registrationEndTime', 
          'costIncludesTax', 
          'taxAmount',
          'startTime',
          'endTime',
          'courseDetails',
          'totalSpots'
        );
    `;
    
    console.log(`📊 Found ${existingColumns.length} existing columns`);
    
    if (existingColumns.length === 8) {
      console.log('✅ All columns already exist!');
    } else {
      console.log('📝 Adding missing columns...');
      
      // Run the migration
      await prisma.$executeRaw`
        ALTER TABLE "Activity" 
        ADD COLUMN IF NOT EXISTS "registrationEndDate" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "registrationEndTime" TEXT,
        ADD COLUMN IF NOT EXISTS "costIncludesTax" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "startTime" TEXT,
        ADD COLUMN IF NOT EXISTS "endTime" TEXT,
        ADD COLUMN IF NOT EXISTS "courseDetails" TEXT,
        ADD COLUMN IF NOT EXISTS "totalSpots" INTEGER;
      `;
      
      console.log('✅ Columns added successfully!');
    }
    
    // Create index
    console.log('\n📝 Creating index...');
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Activity_registrationEndDate_idx" 
      ON "Activity"("registrationEndDate");
    `;
    console.log('✅ Index created!');
    
    // Show statistics
    const stats = await prisma.activity.aggregate({
      _count: true
    });
    
    console.log(`\n📈 Total activities in database: ${stats._count}`);
    
    // Show a sample activity with new fields
    const sample = await prisma.activity.findFirst({
      where: {
        OR: [
          { registrationEndDate: { not: null } },
          { startTime: { not: null } },
          { courseDetails: { not: null } }
        ]
      },
      select: {
        name: true,
        registrationEndDate: true,
        startTime: true,
        endTime: true,
        costIncludesTax: true,
        courseDetails: true
      }
    });
    
    if (sample) {
      console.log('\n📝 Sample activity with new fields:');
      console.log(JSON.stringify(sample, null, 2));
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch(console.error);