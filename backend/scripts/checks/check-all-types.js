require('dotenv').config();
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkAllTypes() {
  const types = await prisma.activity.groupBy({
    by: ['subcategory'],
    where: { isActive: true },
    _count: { subcategory: true },
    orderBy: { _count: { subcategory: 'desc' } },
    take: 50
  });
  
  console.log('Top 50 activity types:');
  types.forEach(t => {
    if (t.subcategory) console.log(`  "${t.subcategory}": ${t._count.subcategory}`);
  });
  
  await prisma.$disconnect();
}

checkAllTypes().catch(console.error);
