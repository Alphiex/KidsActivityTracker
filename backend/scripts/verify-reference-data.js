require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function verifyData() {
  try {
    console.log('📊 Verifying Reference Data:\n');
    
    // Check Categories
    const categories = await prisma.category.findMany({ orderBy: { displayOrder: 'asc' } });
    console.log(`✅ Categories (${categories.length}):`);
    categories.forEach(c => {
      console.log(`   - ${c.name} (${c.code}): Ages ${c.ageMin}-${c.ageMax}, Parent: ${c.requiresParent}`);
    });
    
    // Check Activity Types
    const types = await prisma.activityType.count();
    const subtypes = await prisma.activitySubtype.count();
    console.log(`\n✅ Activity Types: ${types}`);
    console.log(`✅ Activity Subtypes: ${subtypes}`);
    
    // Check for "Other Activity" type
    const otherType = await prisma.activityType.findUnique({ 
      where: { code: 'other-activity' },
      include: { subtypes: true }
    });
    console.log(`\n✅ Other Activity Type exists: ${otherType ? 'Yes' : 'No'}`);
    if (otherType) {
      console.log(`   Subtypes: ${otherType.subtypes.map(s => s.name).join(', ')}`);
    }
    
    // Check Activities needing migration
    const totalActivities = await prisma.activity.count();
    const unmappedActivities = await prisma.activity.count({
      where: { activityType: null }
    });
    
    console.log(`\n📈 Activities Status:`);
    console.log(`   Total Activities: ${totalActivities}`);
    console.log(`   Unmapped Activities: ${unmappedActivities}`);
    console.log(`   Ready for Migration: ${unmappedActivities > 0 ? 'Yes' : 'No new activities to migrate'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyData();