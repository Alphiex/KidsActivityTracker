/**
 * Seed Partner Plans (Bronze, Silver, Gold)
 *
 * These are the subscription tiers for vendors who want sponsored placement.
 * Run this script to populate the PartnerPlan table in the database.
 *
 * Usage: node server/scripts/database/seed-partner-plans.js
 */

require('dotenv').config();

const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

// Partner tier configuration (should match stripeService.ts)
const PARTNER_TIERS = {
  bronze: {
    name: 'Bronze Partner',
    description: 'Sponsored placement for small activity providers',
    monthlyPrice: 49.00, // $49/month
    yearlyPrice: 490.00, // $490/year (save 2 months)
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
    description: 'Priority placement with advanced analytics',
    monthlyPrice: 129.00, // $129/month
    yearlyPrice: 1290.00, // $1,290/year (save 2 months)
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
    description: 'Premium placement with unlimited impressions',
    monthlyPrice: 249.00, // $249/month
    yearlyPrice: 2490.00, // $2,490/year (save 2 months)
    impressionLimit: null, // unlimited
    features: {
      priority: 'top',
      analytics: true,
      targeting: true,
      badge: 'Gold',
      citiesLimit: null, // unlimited
    },
  },
};

async function main() {
  console.log('💳 Seeding partner plans...\n');

  const plans = [];

  for (const [tier, config] of Object.entries(PARTNER_TIERS)) {
    const plan = await prisma.partnerPlan.upsert({
      where: {
        // Use a unique constraint on tier (we need to find by tier)
        id: tier, // We'll use tier as the ID for simplicity
      },
      update: {
        name: config.name,
        monthlyPrice: config.monthlyPrice,
        yearlyPrice: config.yearlyPrice,
        impressionLimit: config.impressionLimit,
        features: config.features,
        isActive: true,
      },
      create: {
        id: tier, // Use tier as ID for predictable lookups
        name: config.name,
        tier: tier,
        monthlyPrice: config.monthlyPrice,
        yearlyPrice: config.yearlyPrice,
        impressionLimit: config.impressionLimit,
        features: config.features,
        isActive: true,
      },
    });

    plans.push(plan);
    console.log(`✅ ${plan.name} (${plan.tier})`);
    console.log(`   Monthly: $${plan.monthlyPrice}/month`);
    console.log(`   Yearly: $${plan.yearlyPrice}/year`);
    console.log(`   Impressions: ${plan.impressionLimit || 'Unlimited'}/month`);
    console.log('');
  }

  console.log('─'.repeat(50));
  console.log(`\n🎉 Successfully seeded ${plans.length} partner plans!\n`);

  // List all plans
  const allPlans = await prisma.partnerPlan.findMany({
    orderBy: { monthlyPrice: 'asc' }
  });

  console.log('📋 Current Partner Plans:');
  console.log('─'.repeat(50));
  for (const plan of allPlans) {
    const features = plan.features;
    console.log(`
${plan.name} (${plan.tier.toUpperCase()})
├─ ID: ${plan.id}
├─ Monthly: $${plan.monthlyPrice}
├─ Yearly: $${plan.yearlyPrice}
├─ Impressions: ${plan.impressionLimit || 'Unlimited'}/month
├─ Analytics: ${features?.analytics ? '✓' : '✗'}
├─ Targeting: ${features?.targeting ? '✓' : '✗'}
└─ Active: ${plan.isActive ? '✓' : '✗'}
    `);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
