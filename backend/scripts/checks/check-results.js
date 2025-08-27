require('dotenv').config();
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkResults() {
  const types = await prisma.activity.groupBy({
    by: ['subcategory'],
    where: { isActive: true },
    _count: { subcategory: true },
    orderBy: { _count: { subcategory: 'desc' } },
    take: 30
  });
  console.log('Top 30 activity types after fix:');
  types.forEach(t => {
    if (t.subcategory) console.log(`  ${t.subcategory}: ${t._count.subcategory} activities`);
  });
  await prisma.$disconnect();
}

checkResults().catch(console.error);
