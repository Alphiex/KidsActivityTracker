const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('💳 Seeding subscription plans...');

  const plans = [
    {
      code: 'free',
      name: 'Discovery',
      description: 'Get started finding activities for your kids',
      monthlyPrice: 0,
      annualPrice: 0,
      maxChildren: 2,
      maxFavorites: 10,
      maxSharedUsers: 1,
      hasAdvancedFilters: false,
      hasCalendarExport: false,
      hasInstantAlerts: false,
      hasSavedSearches: false,
      savedSearchLimit: 0,
      isActive: true,
      displayOrder: 0
    },
    {
      code: 'premium',
      name: 'Family Pro',
      description: 'Never miss the perfect activity for your kids',
      monthlyPrice: 5.99,
      annualPrice: 49.99,
      maxChildren: 99,
      maxFavorites: 999,
      maxSharedUsers: 99,
      hasAdvancedFilters: true,
      hasCalendarExport: true,
      hasInstantAlerts: true,
      hasSavedSearches: true,
      savedSearchLimit: 10,
      isActive: true,
      displayOrder: 1
    }
  ];

  for (const plan of plans) {
    const created = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        maxChildren: plan.maxChildren,
        maxFavorites: plan.maxFavorites,
        maxSharedUsers: plan.maxSharedUsers,
        hasAdvancedFilters: plan.hasAdvancedFilters,
        hasCalendarExport: plan.hasCalendarExport,
        hasInstantAlerts: plan.hasInstantAlerts,
        hasSavedSearches: plan.hasSavedSearches,
        savedSearchLimit: plan.savedSearchLimit,
        isActive: plan.isActive,
        displayOrder: plan.displayOrder
      },
      create: plan
    });
    console.log(`✅ Created/updated plan: ${created.name} (${created.code})`);
  }

  // Log plan details
  const allPlans = await prisma.subscriptionPlan.findMany({
    orderBy: { displayOrder: 'asc' }
  });

  console.log('\n📋 Subscription Plans Summary:');
  console.log('─'.repeat(80));
  for (const plan of allPlans) {
    console.log(`
  ${plan.name} (${plan.code})
  ├─ Price: $${plan.monthlyPrice}/mo or $${plan.annualPrice}/year
  ├─ Children: ${plan.maxChildren === 99 ? 'Unlimited' : plan.maxChildren}
  ├─ Favorites: ${plan.maxFavorites === 999 ? 'Unlimited' : plan.maxFavorites}
  ├─ Shared Users: ${plan.maxSharedUsers === 99 ? 'Unlimited' : plan.maxSharedUsers}
  ├─ Advanced Filters: ${plan.hasAdvancedFilters ? '✓' : '✗'}
  ├─ Calendar Export: ${plan.hasCalendarExport ? '✓' : '✗'}
  ├─ Instant Alerts: ${plan.hasInstantAlerts ? '✓' : '✗'}
  └─ Saved Searches: ${plan.hasSavedSearches ? `✓ (${plan.savedSearchLimit})` : '✗'}
    `);
  }

  console.log('🎉 Subscription plans seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
