#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function fixLocationConstraint() {
  try {
    console.log('🔧 Fixing location constraint...\n');
    
    // Drop the old compound unique constraint
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_name_address_key"
      `);
      console.log('✅ Dropped old compound unique constraint');
    } catch (error) {
      console.log('⚠️  Old constraint may not exist:', error.message);
    }
    
    // Add new unique constraint on name only
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Location" ADD CONSTRAINT "Location_name_key" UNIQUE ("name")
      `);
      console.log('✅ Added unique constraint on name');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Unique constraint on name already exists');
      } else {
        throw error;
      }
    }
    
    // Drop the redundant index on name
    try {
      await prisma.$executeRawUnsafe(`
        DROP INDEX IF EXISTS "Location_name_idx"
      `);
      console.log('✅ Dropped redundant name index');
    } catch (error) {
      console.log('⚠️  Index may not exist:', error.message);
    }
    
    console.log('\n✅ Location constraint fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLocationConstraint();