const { PrismaClient } = require('../../generated/prisma');

async function ensureIsUpdatedColumn() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking for isUpdated column...');
    
    // Check if column exists
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Activity' AND column_name = 'isUpdated'
    `;
    
    if (result.length === 0) {
      console.log('Adding isUpdated column to Activity table...');
      
      // Add the column
      await prisma.$executeRaw`
        ALTER TABLE "Activity" 
        ADD COLUMN "isUpdated" BOOLEAN DEFAULT false
      `;
      
      // Update existing records
      await prisma.$executeRaw`
        UPDATE "Activity" 
        SET "isUpdated" = false 
        WHERE "isUpdated" IS NULL
      `;
      
      console.log('✅ isUpdated column added successfully');
    } else {
      console.log('✅ isUpdated column already exists');
    }
  } catch (error) {
    console.error('Migration error:', error);
    // Don't crash the app if migration fails
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { ensureIsUpdatedColumn };