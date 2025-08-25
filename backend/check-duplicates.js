require('dotenv').config();
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkDuplicates() {
  const types = await prisma.activity.groupBy({
    by: ['subcategory'],
    where: { 
      isActive: true,
      subcategory: { contains: 'Swim' }
    },
    _count: { subcategory: true },
    orderBy: { _count: { subcategory: 'desc' } }
  });
  
  console.log('Swimming-related subcategories:');
  types.forEach(t => {
    if (t.subcategory) console.log(`  "${t.subcategory}": ${t._count.subcategory} activities`);
  });
  
  await prisma.$disconnect();
}

checkDuplicates().catch(console.error);
