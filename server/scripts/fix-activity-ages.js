/**
 * Script to fix activity ages by extracting from activity names.
 *
 * This script:
 * 1. Finds activities with null ageMin and ageMax
 * 2. Extracts age from activity name patterns like "(4-10Y)", "7-12 Beginners", etc.
 * 3. Updates the database with extracted ages
 *
 * Usage: node scripts/fix-activity-ages.js [--dry-run]
 *   --dry-run: Show what would be updated without actually updating
 */

const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Check if activity is for adults
function isAdultActivity(name) {
  if (!name) return false;
  const adultPatterns = [
    /\b(50|55|60|65|70|75|80)\s*\+/i,
    /\b(50|55|60|65|70)\s*(?:yrs?|years?)\s*\+/i,
    /\bseniors?\b/i,
    /\bolder\s*adults?\b/i,
    /\badults?\s*only\b/i,
    /\b(?:19|20|21)\s*(?:yrs?|years?)?\s*\+/i,
    /\bover\s*(19|20|21)\b/i
  ];
  return adultPatterns.some(p => p.test(name));
}

// Extract age from activity name
function extractAgeFromName(name) {
  if (!name) return null;

  // Skip adult activities - they should be purged, not updated
  if (isAdultActivity(name)) {
    return { isAdult: true };
  }

  // Pattern priority (most specific first)
  const patterns = [
    // "(4-10Y)" or "(3-5Y)" format
    { regex: /\((\d+)\s*-\s*(\d+)\s*Y\)/i, type: 'range' },
    // "(5-13yrs)" or "(5-13 yrs)"
    { regex: /\((\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)\)/i, type: 'range' },
    // "(5-13)" just numbers in parentheses
    { regex: /\((\d+)\s*-\s*(\d+)\)/, type: 'range' },
    // "7-12 Beginners" - age range at start
    { regex: /^(\d+)\s*-\s*(\d+)\s+/, type: 'range' },
    // "Kids 5-12" or "Youth 13-17"
    { regex: /(?:kids?|youth|children|teens?)\s*(?:\()?(\d+)\s*-\s*(\d+)/i, type: 'range' },
    // "5-13yrs" or "5-13 years"
    { regex: /(\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)/i, type: 'range' },
    // "ages 5-13"
    { regex: /ages?\s*(\d+)\s*-\s*(\d+)/i, type: 'range' },
    // "18Y+" or "12Y+"
    { regex: /(\d+)\s*Y\s*\+/i, type: 'plus' },
    // "12 yrs+" or "15 yrs+" (whole number before yrs)
    { regex: /\((\d+)\s*(?:yrs?|years?)\s*\+\)/i, type: 'plus' },
    // "12+" or "18+" (but not decimal like 16.5+)
    { regex: /\((\d+)\s*\+\)/, type: 'plus' }
  ];

  for (const { regex, type } of patterns) {
    const match = name.match(regex);
    if (match) {
      if (type === 'range') {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        // Validate it looks like an age range for kids
        if (min >= 0 && min <= 18 && max <= 99 && min <= max) {
          return { min, max: Math.min(max, 18) };
        }
      } else if (type === 'plus') {
        const min = parseInt(match[1]);
        // Only for kids activities (min <= 18)
        if (min >= 0 && min <= 18) {
          return { min, max: 18 };
        }
      }
    }
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('FIX ACTIVITY AGES SCRIPT');
  console.log(dryRun ? '(DRY RUN - No changes will be made)' : '(LIVE MODE - Activities will be updated)');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Find activities with null ages but age info in name
    console.log('Finding activities with missing age data...\n');

    const activities = await prisma.activity.findMany({
      where: {
        AND: [
          { ageMin: null },
          { ageMax: null },
          { isActive: true },
          {
            OR: [
              { name: { contains: '-' } },
              { name: { contains: '+' } },
              { name: { contains: '(' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        ageMin: true,
        ageMax: true,
        provider: { select: { name: true } }
      }
    });

    console.log(`Found ${activities.length} activities to check\n`);

    // Process activities
    const toUpdate = [];
    const adultActivities = [];
    const noMatch = [];

    for (const activity of activities) {
      const extracted = extractAgeFromName(activity.name);
      if (extracted) {
        if (extracted.isAdult) {
          adultActivities.push(activity);
        } else {
          toUpdate.push({
            id: activity.id,
            name: activity.name,
            provider: activity.provider?.name,
            ageMin: extracted.min,
            ageMax: extracted.max
          });
        }
      } else {
        noMatch.push(activity);
      }
    }

    console.log(`Can extract age for ${toUpdate.length} kids activities`);
    console.log(`Found ${adultActivities.length} adult activities (should be purged)`);
    console.log(`No age pattern found in ${noMatch.length} activities\n`);

    if (adultActivities.length > 0) {
      console.log('Adult activities found (run purge-adult-activities.js to remove):');
      for (const activity of adultActivities.slice(0, 5)) {
        console.log(`  - ${activity.name}`);
      }
      if (adultActivities.length > 5) {
        console.log(`  ... and ${adultActivities.length - 5} more`);
      }
      console.log('');
    }

    if (toUpdate.length === 0) {
      console.log('No activities to update.');
      return;
    }

    // Show sample updates
    console.log('Sample updates (first 20):');
    for (const activity of toUpdate.slice(0, 20)) {
      console.log(`  [${activity.provider || 'Unknown'}] ${activity.name}`);
      console.log(`    -> ageMin: ${activity.ageMin}, ageMax: ${activity.ageMax}`);
    }
    if (toUpdate.length > 20) {
      console.log(`  ... and ${toUpdate.length - 20} more`);
    }
    console.log('');

    // Show breakdown by age range
    const byAgeRange = {};
    for (const activity of toUpdate) {
      const range = `${activity.ageMin}-${activity.ageMax}`;
      byAgeRange[range] = (byAgeRange[range] || 0) + 1;
    }
    console.log('Age range distribution:');
    for (const [range, count] of Object.entries(byAgeRange).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${range}: ${count}`);
    }
    console.log('');

    if (dryRun) {
      console.log('DRY RUN complete. No changes made.');
      console.log(`Would have updated ${toUpdate.length} activities.`);
      return;
    }

    // Perform updates
    console.log('Updating activities...');

    let updated = 0;
    for (const activity of toUpdate) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          ageMin: activity.ageMin,
          ageMax: Math.min(activity.ageMax, 18) // Cap at 18 for kids
        }
      });
      updated++;
      if (updated % 100 === 0) {
        console.log(`  Updated ${updated}/${toUpdate.length}...`);
      }
    }

    console.log(`\nSuccessfully updated ${updated} activities.`);

    // Show remaining null ages
    const stillNull = await prisma.activity.count({
      where: {
        isActive: true,
        ageMin: null,
        ageMax: null
      }
    });
    console.log(`\nRemaining activities with no age data: ${stillNull}`);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
