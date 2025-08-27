const { PrismaClient } = require('./generated/prisma');

async function runMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Running production migration for new categorization system...');
    
    // Add new columns to Activity table
    console.log('📝 Adding new columns to Activity table...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Activity" 
      ADD COLUMN IF NOT EXISTS "activityType" TEXT,
      ADD COLUMN IF NOT EXISTS "activitySubtype" TEXT,
      ADD COLUMN IF NOT EXISTS "requiresParent" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "parentInvolvement" TEXT
    `);
    
    // Create Category table
    console.log('📝 Creating Category table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Category" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "ageMin" INTEGER NOT NULL,
        "ageMax" INTEGER NOT NULL,
        "requiresParent" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
      )
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Category_code_key" ON "Category"("code")
    `);
    
    // Create ActivityType table
    console.log('📝 Creating ActivityType table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityType" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "imageUrl" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
      )
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ActivityType_name_key" ON "ActivityType"("name")
    `);
    
    // Create ActivitySubtype table
    console.log('📝 Creating ActivitySubtype table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivitySubtype" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "activityTypeId" TEXT NOT NULL,
        "description" TEXT,
        "imageUrl" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "ActivitySubtype_pkey" PRIMARY KEY ("id")
      )
    `);
    
    // Add foreign key constraint separately to handle if it doesn't exist
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ActivitySubtype" 
        ADD CONSTRAINT "ActivitySubtype_activityTypeId_fkey" 
        FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (e) {
      // Constraint might already exist
    }
    
    // Create ActivityCategory junction table
    console.log('📝 Creating ActivityCategory junction table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityCategory" (
        "id" TEXT NOT NULL,
        "activityId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "ActivityCategory_pkey" PRIMARY KEY ("id")
      )
    `);
    
    // Add foreign key constraints
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ActivityCategory" 
        ADD CONSTRAINT "ActivityCategory_activityId_fkey" 
        FOREIGN KEY ("activityId") REFERENCES "Activity"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (e) {
      // Constraint might already exist
    }
    
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ActivityCategory" 
        ADD CONSTRAINT "ActivityCategory_categoryId_fkey" 
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
    } catch (e) {
      // Constraint might already exist
    }
    
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ActivityCategory_activityId_categoryId_key" 
      ON "ActivityCategory"("activityId", "categoryId")
    `);
    
    // Create UnmappedActivity table
    console.log('📝 Creating UnmappedActivity table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UnmappedActivity" (
        "id" TEXT NOT NULL,
        "originalName" TEXT NOT NULL,
        "originalSection" TEXT,
        "count" INTEGER NOT NULL DEFAULT 1,
        "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "suggestedType" TEXT,
        "suggestedSubtype" TEXT,
        "reviewed" BOOLEAN NOT NULL DEFAULT false,
        
        CONSTRAINT "UnmappedActivity_pkey" PRIMARY KEY ("id")
      )
    `);
    
    // Insert age-based categories
    console.log('📝 Inserting age-based categories...');
    const categories = [
      { code: 'baby-parent', name: 'Baby & Parent', ageMin: 0, ageMax: 1, requiresParent: true },
      { code: 'preschool', name: 'Preschool', ageMin: 2, ageMax: 4, requiresParent: false },
      { code: 'school-age', name: 'School Age', ageMin: 5, ageMax: 13, requiresParent: false },
      { code: 'teen', name: 'Teen', ageMin: 14, ageMax: 18, requiresParent: false },
      { code: 'all-ages', name: 'All Ages', ageMin: 0, ageMax: 99, requiresParent: false }
    ];
    
    for (const cat of categories) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Category" (id, code, name, "ageMin", "ageMax", "requiresParent")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
        ON CONFLICT (code) DO NOTHING
      `, cat.code, cat.name, cat.ageMin, cat.ageMax, cat.requiresParent);
    }
    
    // Insert activity types
    console.log('📝 Inserting activity types...');
    const activityTypes = [
      'Swimming & Aquatics', 'Sports - Team', 'Sports - Individual', 
      'Arts & Crafts', 'Dance', 'Music', 'Martial Arts', 'Gymnastics',
      'Ice Sports', 'Camps', 'Fitness', 'Parent & Child', 'Other Activity'
    ];
    
    for (const typeName of activityTypes) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ActivityType" (id, name, "displayOrder")
        VALUES (gen_random_uuid()::text, $1, 0)
        ON CONFLICT (name) DO NOTHING
      `, typeName);
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the migration
    console.log('\n📊 Verifying migration results:');
    
    const categoryCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Category"`;
    console.log(`  - Categories: ${categoryCount[0].count}`);
    
    const activityTypeCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "ActivityType"`;
    console.log(`  - Activity Types: ${activityTypeCount[0].count}`);
    
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Activity' 
      AND column_name IN ('activityType', 'activitySubtype', 'requiresParent', 'parentInvolvement')
    `;
    console.log(`  - New Activity columns: ${columns.length}/4`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();