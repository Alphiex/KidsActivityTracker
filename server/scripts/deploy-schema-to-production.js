const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Deploy schema changes and seed data to production
 */

async function deploySchemaToProduction() {
  console.log('🚀 DEPLOYING SCHEMA CHANGES TO PRODUCTION');
  console.log('==========================================\n');

  try {
    // Set production DATABASE_URL
    const productionDBUrl = 'postgresql://postgres:Murm4n5P1ck5!@34.42.149.102:5432/kidsactivity';
    process.env.DATABASE_URL = productionDBUrl;
    
    console.log('📊 Step 1: Push schema changes to production...');
    
    // Push schema changes
    const { stdout: pushOutput, stderr: pushError } = await execAsync('npx prisma db push --accept-data-loss');
    console.log('✅ Schema push output:', pushOutput);
    if (pushError) console.log('⚠️ Schema push warnings:', pushError);
    
    console.log('\n🔄 Step 2: Generate Prisma client...');
    const { stdout: generateOutput } = await execAsync('npx prisma generate');
    console.log('✅ Generate output:', generateOutput);
    
    console.log('\n🌱 Step 3: Seed activity types and categories...');
    
    // Run activity types seed
    const { stdout: activityTypesOutput } = await execAsync('node seed-activity-types.js');
    console.log('✅ Activity types seeded:', activityTypesOutput);
    
    // Run categories seed
    const { stdout: categoriesOutput } = await execAsync('node scripts/seed-categories.js');
    console.log('✅ Categories seeded:', categoriesOutput);
    
    console.log('\n✅ PRODUCTION SCHEMA DEPLOYMENT COMPLETED!');
    console.log('🎯 Ready to run unified recategorization script');
    
  } catch (error) {
    console.error('❌ Error deploying schema to production:', error);
    throw error;
  }
}

if (require.main === module) {
  deploySchemaToProduction()
    .then(() => {
      console.log('\n🎉 Deployment successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deploySchemaToProduction };