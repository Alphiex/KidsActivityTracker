const { PrismaClient } = require('./generated/prisma');

async function createTables() {
  console.log('🔄 Creating missing tables in production...');
  
  // Load production environment
  require('dotenv').config({ path: '.env.production' });
  
  const prisma = new PrismaClient();
  
  try {
    // Create ActivitySession table
    console.log('\n📋 Creating ActivitySession table...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ActivitySession" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "activityId" TEXT NOT NULL,
          "sessionNumber" INTEGER,
          "date" TEXT,
          "dayOfWeek" TEXT,
          "startTime" TEXT,
          "endTime" TEXT,
          "location" TEXT,
          "subLocation" TEXT,
          "instructor" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('   ✅ ActivitySession table created');
    } catch (error) {
      console.log('   ⚠️  ActivitySession table already exists or error:', error.message);
    }

    // Create ActivityPrerequisite table
    console.log('\n📋 Creating ActivityPrerequisite table...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ActivityPrerequisite" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "activityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "url" TEXT,
          "courseId" TEXT,
          "isRequired" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ActivityPrerequisite_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('   ✅ ActivityPrerequisite table created');
    } catch (error) {
      console.log('   ⚠️  ActivityPrerequisite table already exists or error:', error.message);
    }

    // Add foreign key constraints
    console.log('\n📋 Adding foreign key constraints...');
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ActivitySession" 
        ADD CONSTRAINT "ActivitySession_activityId_fkey" 
        FOREIGN KEY ("activityId") REFERENCES "Activity"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('   ✅ ActivitySession foreign key added');
    } catch (error) {
      console.log('   ⚠️  ActivitySession foreign key already exists or error:', error.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ActivityPrerequisite" 
        ADD CONSTRAINT "ActivityPrerequisite_activityId_fkey" 
        FOREIGN KEY ("activityId") REFERENCES "Activity"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('   ✅ ActivityPrerequisite foreign key added');
    } catch (error) {
      console.log('   ⚠️  ActivityPrerequisite foreign key already exists or error:', error.message);
    }

    // Create indexes
    console.log('\n📋 Creating indexes...');
    const indexes = [
      { table: 'ActivitySession', column: 'activityId' },
      { table: 'ActivitySession', column: 'date' },
      { table: 'ActivityPrerequisite', column: 'activityId' },
      { table: 'Activity', column: 'registrationStatus' },
      { table: 'Activity', columns: ['latitude', 'longitude'] },
      { table: 'Activity', column: 'lastSeenAt' }
    ];

    for (const index of indexes) {
      try {
        const indexName = index.columns 
          ? `${index.table}_${index.columns.join('_')}_idx`
          : `${index.table}_${index.column}_idx`;
        const columnList = index.columns 
          ? index.columns.map(c => `"${c}"`).join(', ')
          : `"${index.column}"`;
        
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${indexName}" 
          ON "${index.table}"(${columnList})
        `);
        console.log(`   ✅ Index ${indexName} created`);
      } catch (error) {
        console.log(`   ⚠️  Index creation error:`, error.message);
      }
    }

    // Add missing columns to Activity table
    console.log('\n📋 Adding missing columns to Activity table...');
    const columns = [
      { name: 'dates', type: 'TEXT' },
      { name: 'registrationEndDate', type: 'TIMESTAMP(3)' },
      { name: 'registrationEndTime', type: 'TEXT' },
      { name: 'costIncludesTax', type: 'BOOLEAN DEFAULT true' },
      { name: 'taxAmount', type: 'DOUBLE PRECISION' },
      { name: 'totalSpots', type: 'INTEGER' },
      { name: 'courseId', type: 'TEXT' },
      { name: 'lastSeenAt', type: 'TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP' },
      { name: 'startTime', type: 'TEXT' },
      { name: 'endTime', type: 'TEXT' },
      { name: 'registrationStatus', type: 'TEXT DEFAULT \'Unknown\'' },
      { name: 'registrationButtonText', type: 'TEXT' },
      { name: 'detailUrl', type: 'TEXT' },
      { name: 'fullDescription', type: 'TEXT' },
      { name: 'instructor', type: 'TEXT' },
      { name: 'prerequisites', type: 'TEXT' },
      { name: 'whatToBring', type: 'TEXT' },
      { name: 'fullAddress', type: 'TEXT' },
      { name: 'latitude', type: 'DOUBLE PRECISION' },
      { name: 'longitude', type: 'DOUBLE PRECISION' },
      { name: 'directRegistrationUrl', type: 'TEXT' },
      { name: 'contactInfo', type: 'TEXT' },
      { name: 'courseDetails', type: 'TEXT' },
      { name: 'hasMultipleSessions', type: 'BOOLEAN DEFAULT false' },
      { name: 'sessionCount', type: 'INTEGER DEFAULT 0' },
      { name: 'hasPrerequisites', type: 'BOOLEAN DEFAULT false' }
    ];

    for (const column of columns) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Activity" 
          ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}
        `);
        console.log(`   ✅ Column ${column.name} added`);
      } catch (error) {
        console.log(`   ⚠️  Column ${column.name} already exists or error:`, error.message);
      }
    }

    // Verify results
    console.log('\n📊 Verification:');
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Activity', 'ActivitySession', 'ActivityPrerequisite')
      ORDER BY table_name
    `;
    
    console.log('\n✅ Tables:');
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    
    // Count enhanced activities
    const totalActivities = await prisma.activity.count();
    const enhancedCount = await prisma.activity.count({
      where: {
        OR: [
          { instructor: { not: null } },
          { fullDescription: { not: null } },
          { dates: { not: null } }
        ]
      }
    });
    
    console.log(`\n📈 Activity Statistics:`);
    console.log(`   - Total activities: ${totalActivities}`);
    console.log(`   - Enhanced activities: ${enhancedCount}`);
    
    console.log('\n✅ Schema update completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTables();