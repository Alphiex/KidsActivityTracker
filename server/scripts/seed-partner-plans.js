const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

const PARTNER_TIERS = {
  bronze: {
    name: 'Bronze Partner',
    tier: 'bronze',
    monthlyPrice: 49,
    yearlyPrice: 490,
    impressionLimit: 5000,
    features: {
      priority: 'basic',
      analytics: true,
      targeting: false,
      badge: 'Bronze',
      citiesLimit: 1,
    },
  },
  silver: {
    name: 'Silver Partner',
    tier: 'silver',
    monthlyPrice: 129,
    yearlyPrice: 1290,
    impressionLimit: 25000,
    features: {
      priority: 'high',
      analytics: true,
      targeting: true,
      badge: 'Silver',
      citiesLimit: 3,
    },
  },
  gold: {
    name: 'Gold Partner',
    tier: 'gold',
    monthlyPrice: 249,
    yearlyPrice: 2490,
    impressionLimit: null,
    features: {
      priority: 'top',
      analytics: true,
      targeting: true,
      badge: 'Gold',
      citiesLimit: null,
    },
  },
};

async function seedPlans() {
  console.log('Seeding partner plans...');

  for (const [tier, config] of Object.entries(PARTNER_TIERS)) {
    // Check if plan already exists
    const existingPlan = await prisma.partnerPlan.findFirst({
      where: { tier },
    });

    if (existingPlan) {
      console.log(`  ${tier}: Already exists (${existingPlan.id})`);
      continue;
    }

    // Create the plan
    const plan = await prisma.partnerPlan.create({
      data: {
        name: config.name,
        tier: config.tier,
        monthlyPrice: config.monthlyPrice,
        yearlyPrice: config.yearlyPrice,
        impressionLimit: config.impressionLimit,
        features: config.features,
        isActive: true,
      },
    });

    console.log(`  ${tier}: Created (${plan.id})`);
  }

  console.log('Done!');
}

seedPlans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
