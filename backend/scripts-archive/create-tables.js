const { PrismaClient } = require('./generated/prisma');

async function createTables() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📝 Creating reference tables...');
    
    // Create Category table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Category" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "ageMin" INTEGER NOT NULL,
        "ageMax" INTEGER NOT NULL,
        "requiresParent" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Category_code_key" UNIQUE ("code")
      )
    `);
    console.log('✅ Category table created');
    
    // Create ActivityType table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityType" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "imageUrl" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ActivityType_name_key" UNIQUE ("name")
      )
    `);
    console.log('✅ ActivityType table created');
    
    // Create ActivitySubtype table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivitySubtype" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL,
        "activityTypeId" TEXT NOT NULL,
        "description" TEXT,
        "imageUrl" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "ActivitySubtype_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ActivitySubtype_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") 
          REFERENCES "ActivityType"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    console.log('✅ ActivitySubtype table created');
    
    // Create ActivityCategory junction table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityCategory" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "activityId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "ActivityCategory_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ActivityCategory_activityId_fkey" FOREIGN KEY ("activityId") 
          REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ActivityCategory_categoryId_fkey" FOREIGN KEY ("categoryId") 
          REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ActivityCategory_activityId_categoryId_key" UNIQUE ("activityId", "categoryId")
      )
    `);
    console.log('✅ ActivityCategory table created');
    
    // Create UnmappedActivity table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UnmappedActivity" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
    console.log('✅ UnmappedActivity table created');
    
    console.log('\n✅ All tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTables().catch(console.error);