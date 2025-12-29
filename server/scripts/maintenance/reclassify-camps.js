/**
 * Migration script to reclassify existing activities that are camps
 * but were incorrectly categorized as other activity types
 *
 * Run with:
 * node scripts/maintenance/reclassify-camps.js
 *
 * Or for production:
 * DATABASE_URL='postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity' node scripts/maintenance/reclassify-camps.js
 */

const { PrismaClient } = require('../../generated/prisma');

const prisma = new PrismaClient();

// Camp subtype patterns - determines which camp subtype to assign
const CAMP_SUBTYPE_PATTERNS = [
  // Activity-specific camps (check first - most specific)
  { regex: /swim|aqua|water/i, subtypeCode: 'swimming-camps' },
  { regex: /soccer|basketball|hockey|volleyball|baseball|football|lacrosse|team sport/i, subtypeCode: 'team-sports-camps' },
  { regex: /tennis|badminton|squash|pickleball|racquet/i, subtypeCode: 'racquet-sports-camps' },
  { regex: /golf|archery|track|running|cycling/i, subtypeCode: 'individual-sports-camps' },
  { regex: /dance|ballet|jazz|hip hop|tap/i, subtypeCode: 'dance-camps' },
  { regex: /music|piano|guitar|drum|violin|band|orchestra/i, subtypeCode: 'music-camps' },
  { regex: /drama|theatre|theater|acting|improv|perform/i, subtypeCode: 'performing-arts-camps' },
  { regex: /art|paint|draw|pottery|craft|sculpt/i, subtypeCode: 'visual-arts-camps' },
  { regex: /martial|karate|taekwondo|judo|kung fu|boxing|kickbox/i, subtypeCode: 'martial-arts-camps' },
  { regex: /gymnast|tumbl|trampoline|parkour|acro/i, subtypeCode: 'gymnastics-camps' },
  { regex: /skat|ice|roller|figure/i, subtypeCode: 'skating-camps' },
  { regex: /outdoor|adventure|nature|hiking|climb/i, subtypeCode: 'outdoor-adventure-camps' },
  { regex: /cook|culinary|baking|chef/i, subtypeCode: 'cooking-camps' },
  { regex: /language|french|spanish|mandarin/i, subtypeCode: 'language-camps' },
  { regex: /stem|science|tech|coding|robot|engineer/i, subtypeCode: 'stem-camps' },
  // Seasonal/Section-based camps (check section names that imply camps)
  { regex: /march break|spring break/i, subtypeCode: 'march-break-camps' },
  { regex: /pa day|pd day|pro.?d day/i, subtypeCode: 'day-camps' },  // PA/PD days are typically day camps
  { regex: /holiday program|christmas break|winter break/i, subtypeCode: 'winter-camps' },
  { regex: /summer program|summer/i, subtypeCode: 'summer-camps' },
  // Format-based camps
  { regex: /overnight|residential|sleepover/i, subtypeCode: 'overnight-camps' },
  { regex: /multi|general|variety|explorer/i, subtypeCode: 'multi-activity-camps' },
  // Generic fallback
  { regex: /sport/i, subtypeCode: 'sports-camps' },
];

async function reclassifyCamps() {
  console.log('=========================================');
  console.log('Camp Reclassification Migration');
  console.log('=========================================\n');

  // Step 1: Get the Camps activity type ID
  console.log('Step 1: Finding Camps activity type...');
  const campsType = await prisma.activityType.findUnique({
    where: { code: 'camps' }
  });

  if (!campsType) {
    console.error('ERROR: Could not find Camps activity type!');
    console.error('Please run the seed script first: node scripts/database/seed-activity-types-enhanced.js');
    return { success: false, error: 'Camps type not found' };
  }

  console.log(`Found Camps type: ${campsType.id}\n`);

  // Step 2: Get all camp subtypes
  console.log('Step 2: Loading camp subtypes...');
  const campSubtypes = await prisma.activitySubtype.findMany({
    where: { activityTypeId: campsType.id }
  });

  const subtypeMap = {};
  campSubtypes.forEach(s => {
    subtypeMap[s.code] = s.id;
  });

  console.log(`Found ${campSubtypes.length} camp subtypes:`);
  campSubtypes.forEach(s => console.log(`  - ${s.code}: ${s.name}`));
  console.log('');

  // Step 3: Find all activities that should be camps but are NOT categorized as Camps
  // This includes: "camp" in name, OR activities from camp-implied sections
  // (e.g., "March Break", "Spring Break", "PA Day", "PD Day", "Summer Programs")
  console.log('Step 3: Finding miscategorized camp activities...');
  const miscategorizedCamps = await prisma.activity.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { contains: 'camp', mode: 'insensitive' } },
            { category: { contains: 'camp', mode: 'insensitive' } },
            { subcategory: { contains: 'camp', mode: 'insensitive' } },
            { category: { contains: 'march break', mode: 'insensitive' } },
            { category: { contains: 'spring break', mode: 'insensitive' } },
            { category: { contains: 'pa day', mode: 'insensitive' } },
            { category: { contains: 'pd day', mode: 'insensitive' } },
            { category: { contains: 'pro d day', mode: 'insensitive' } },
            { category: { contains: 'pro-d day', mode: 'insensitive' } },
            { category: { contains: 'holiday program', mode: 'insensitive' } },
            { category: { contains: 'winter break', mode: 'insensitive' } },
            { category: { contains: 'christmas break', mode: 'insensitive' } },
            { category: { contains: 'summer program', mode: 'insensitive' } },
            { subcategory: { contains: 'march break', mode: 'insensitive' } },
            { subcategory: { contains: 'spring break', mode: 'insensitive' } },
            { subcategory: { contains: 'pa day', mode: 'insensitive' } },
            { subcategory: { contains: 'pd day', mode: 'insensitive' } },
            { subcategory: { contains: 'holiday program', mode: 'insensitive' } },
            { subcategory: { contains: 'summer program', mode: 'insensitive' } },
          ]
        },
        { activityTypeId: { not: campsType.id } }
      ]
    },
    select: {
      id: true,
      name: true,
      category: true,
      subcategory: true,
      activityTypeId: true,
      activitySubtypeId: true,
      activityType: { select: { name: true, code: true } }
    }
  });

  console.log(`Found ${miscategorizedCamps.length} camp activities incorrectly categorized\n`);

  if (miscategorizedCamps.length === 0) {
    console.log('No miscategorized camps found! All camps are already properly categorized.');

    // Show current camp statistics
    const campCount = await prisma.activity.count({
      where: { activityTypeId: campsType.id }
    });
    console.log(`\nTotal activities currently categorized as Camps: ${campCount}`);

    return { success: true, updated: 0, errors: 0 };
  }

  // Step 4: Show sample of what will be reclassified
  console.log('Step 4: Sample of activities to be reclassified:');
  const sampleSize = Math.min(10, miscategorizedCamps.length);
  for (let i = 0; i < sampleSize; i++) {
    const activity = miscategorizedCamps[i];
    console.log(`  "${activity.name}" - Currently: ${activity.activityType?.name || 'Unknown'}`);
  }
  if (miscategorizedCamps.length > sampleSize) {
    console.log(`  ... and ${miscategorizedCamps.length - sampleSize} more`);
  }
  console.log('');

  // Step 5: Reclassify each activity
  console.log('Step 5: Reclassifying activities...');
  let updated = 0;
  let errors = 0;
  const errorDetails = [];

  for (const activity of miscategorizedCamps) {
    // Determine the correct camp subtype
    const searchText = `${activity.name} ${activity.category || ''} ${activity.subcategory || ''}`.toLowerCase();
    let subtypeCode = 'day-camps'; // Default

    for (const pattern of CAMP_SUBTYPE_PATTERNS) {
      if (pattern.regex.test(searchText)) {
        subtypeCode = pattern.subtypeCode;
        break;
      }
    }

    const subtypeId = subtypeMap[subtypeCode];

    if (!subtypeId) {
      console.log(`  Warning: Could not find subtype ${subtypeCode}, using day-camps`);
      subtypeCode = 'day-camps';
    }

    try {
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          activityTypeId: campsType.id,
          activitySubtypeId: subtypeMap[subtypeCode] || null,
          updatedAt: new Date()
        }
      });

      updated++;

      // Log every 100 updates
      if (updated % 100 === 0) {
        console.log(`  Processed ${updated}/${miscategorizedCamps.length} activities...`);
      }
    } catch (error) {
      errors++;
      errorDetails.push({
        activityId: activity.id,
        name: activity.name,
        error: error.message
      });
    }
  }

  // Step 6: Summary
  console.log('\n=========================================');
  console.log('Camp Reclassification Complete');
  console.log('=========================================');
  console.log(`Total miscategorized camps found: ${miscategorizedCamps.length}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log('\nError details (first 5):');
    errorDetails.slice(0, 5).forEach(e => {
      console.log(`  - ${e.name}: ${e.error}`);
    });
  }

  // Verify final counts
  const campCount = await prisma.activity.count({
    where: { activityTypeId: campsType.id }
  });
  console.log(`\nTotal activities now categorized as Camps: ${campCount}`);

  // Show breakdown by subtype
  console.log('\nCamp activities by subtype:');
  const subtypeCounts = await prisma.activity.groupBy({
    by: ['activitySubtypeId'],
    where: { activityTypeId: campsType.id },
    _count: { id: true }
  });

  for (const count of subtypeCounts) {
    const subtype = campSubtypes.find(s => s.id === count.activitySubtypeId);
    const subtypeName = subtype ? subtype.name : 'Unknown';
    console.log(`  - ${subtypeName}: ${count._count.id}`);
  }

  return { success: true, updated, errors, errorDetails };
}

async function main() {
  console.log('Starting Camp Reclassification Migration\n');
  console.log(`Database: ${process.env.DATABASE_URL ? 'Custom (from env)' : 'Default (local)'}\n`);

  try {
    const result = await reclassifyCamps();

    if (result.success) {
      console.log('\nMigration completed successfully!');
      process.exit(0);
    } else {
      console.error('\nMigration failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { reclassifyCamps };
