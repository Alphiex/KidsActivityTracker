require('dotenv').config();
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkSubcategories() {
  const types = await prisma.activity.groupBy({
    by: ['subcategory'],
    where: { 
      isActive: true,
      subcategory: { contains: '(' }
    },
    _count: { subcategory: true },
    orderBy: { _count: { subcategory: 'desc' } }
  });
  
  console.log('Subcategories with parentheses:');
  types.forEach(t => {
    console.log(`  "${t.subcategory}": ${t._count.subcategory}`);
  });
  
  await prisma.$disconnect();
}

checkSubcategories().catch(console.error);
