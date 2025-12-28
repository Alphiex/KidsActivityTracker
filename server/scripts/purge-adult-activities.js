/**
 * Script to purge adult-only activities from the database.
 *
 * This script identifies and removes activities that are:
 * 1. Explicitly for adults (55+, seniors, 18+ only, etc.)
 * 2. Have ageMin > 18
 * 3. Match adult-only patterns in their names
 *
 * Usage: node scripts/purge-adult-activities.js [--dry-run] [--force]
 *   --dry-run: Show what would be deleted without actually deleting
 *   --force: Skip confirmation prompt
 */

const { PrismaClient } = require('../generated/prisma');
const readline = require('readline');

const prisma = new PrismaClient();

// Patterns that indicate adult-only activities
const ADULT_PATTERNS = [
  // Senior age patterns
  /\b(50|55|60|65|70|75|80)\s*\+/i,
  /\bfor\s*(50|55|60|65|70)\s*\+/i,
  /\bseniors?\b/i,
  /\bsenior\s*(citizen|adult)s?\b/i,
  /\bolder\s*adults?\b/i,
  /\bactive\s*aging\b/i,
  /\bretirement\b/i,
  /\bmature\s*adults?\b/i,
  /\bgolden\s*(age|years)\b/i,

  // Adult-only patterns
  /\badults?\s*only\b/i,
  /\badults?\s*\(?(18|19|21)\+?\)?/i,
  /\b(18|19|21)\s*(?:years?\s*)?(and\s*over|\+|older)/i,
  /\bover\s*(18|19|21)\b/i,
  /\b(18|19|21)\s*y(?:ears?)?\s*\+/i,

  // Age-restricted patterns
  /\bage\s*(18|19|21)\s*(and\s*over|\+)/i,
  /\bminimum\s*age\s*(18|19|21)/i
];

// Extract age from activity name
function extractAgeFromName(name) {
  if (!name) return null;

  // Check for senior/adult patterns first
  const seniorMatch = name.match(/\b(50|55|60|65|70|75|80)\s*\+/i);
  if (seniorMatch) {
    return { min: parseInt(seniorMatch[1]), max: 99, isAdult: true };
  }

  // Check for 18+, 19+, 21+ patterns
  const adultMatch = name.match(/\b(18|19|21)\s*(?:y(?:ears?)?)?\s*\+/i);
  if (adultMatch) {
    return { min: parseInt(adultMatch[1]), max: 99, isAdult: true };
  }

  // Check for age ranges like "(4-10Y)" or "(55-65)"
  const rangeMatch = name.match(/\((\d+)\s*-\s*(\d+)\s*(?:Y|yrs?|years?)?\)/i);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]);
    const max = parseInt(rangeMatch[2]);
    return { min, max, isAdult: min > 18 };
  }

  return null;
}

// Check if activity has valid kids age data
function hasValidKidsAge(activity) {
  // If ageMin is set and is a reasonable kids age (0-18), it's a kids activity
  if (activity.ageMin !== null && activity.ageMin >= 0 && activity.ageMin <= 18) {
    return true;
  }
  // If ageMax is set and reasonable (0-18), it's likely a kids activity
  if (activity.ageMax !== null && activity.ageMax >= 0 && activity.ageMax <= 18) {
    return true;
  }
  return false;
}

// Check if activity should be purged
function shouldPurgeActivity(activity) {
  const name = activity.name || '';

  // Check 1: Explicit senior age patterns (55+, 60+, etc.) - VERY reliable
  // These ALWAYS get purged, even if they have bad age data showing kids ages
  // Note: Use (?<!\.) to avoid matching "3.75+" as "75+"
  const seniorAgePatterns = [
    /(?<![.\d])(50|55|60|65|70|75|80)\s*\+/i,
    /(?<![.\d])(50|55|60|65|70)\s*(?:yrs?|years?)\s*(?:and\s*(?:over|older)|\+)/i
  ];
  for (const pattern of seniorAgePatterns) {
    if (pattern.test(name)) {
      return { shouldPurge: true, reason: `Senior age: ${pattern.source}` };
    }
  }

  // Check 2: "Seniors" as standalone word (not "Senior Day Camp")
  // These also get purged regardless of age data
  if (/\bseniors\b/i.test(name) && !/\bcamp\b/i.test(name) && !/\bday\s*camp\b/i.test(name)) {
    return { shouldPurge: true, reason: 'Seniors keyword' };
  }

  // Check 2b: Explicit "18+" or "(18+)" or "18+ years" patterns - adult only
  // These are clearly adult-only activities
  const adultAge18Patterns = [
    /\(18\s*\+\)/i,                          // "(18+)"
    /\(ages?\s*18\s*\+\)/i,                  // "(Ages 18+)" or "(Age 18+)"
    /18\s*\+\s*(?:yrs?|years?)/i,            // "18+ yrs" or "18+ years"
    /\b18\s*(?:yrs?|years?)\s*\+/i,          // "18 yrs+" or "18 years+"
    /\bages?\s*18\s*\+/i                     // "Ages 18+" or "Age 18+"
  ];
  for (const pattern of adultAge18Patterns) {
    if (pattern.test(name)) {
      return { shouldPurge: true, reason: `Adult 18+: ${pattern.source}` };
    }
  }

  // SAFETY: If activity has valid kids ages in database, DON'T purge
  // (e.g., "Senior Day Camp" with ages 7-12 is for kids)
  // But only apply this check for non-explicit adult patterns
  if (hasValidKidsAge(activity)) {
    return { shouldPurge: false, reason: null };
  }

  // Check 3: Adult-only patterns (18+, 19+, etc.) in name
  const adultOnlyPatterns = [
    /\badults?\s*only\b/i,
    /\b(18|19|21)\s*(?:years?\s*)?(and\s*over|\+|older)/i,
    /\b(18|19|21)\s*y(?:ears?)?\s*\+/i,
    /\bover\s*(18|19|21)\b/i
  ];
  for (const pattern of adultOnlyPatterns) {
    if (pattern.test(name)) {
      return { shouldPurge: true, reason: `Adult only: ${pattern.source}` };
    }
  }

  // Check 4: Extract age from name
  const nameAge = extractAgeFromName(name);
  if (nameAge && nameAge.isAdult) {
    return { shouldPurge: true, reason: `Name indicates age ${nameAge.min}+` };
  }

  // Check 5: ageMin > 18 in database, BUT only if it's a reasonable age (19-100)
  if (activity.ageMin !== null && activity.ageMin > 18 && activity.ageMin <= 100) {
    return { shouldPurge: true, reason: `ageMin=${activity.ageMin}` };
  }

  return { shouldPurge: false, reason: null };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log('='.repeat(60));
  console.log('ADULT ACTIVITY PURGE SCRIPT');
  console.log(dryRun ? '(DRY RUN - No changes will be made)' : '(LIVE MODE - Activities will be deleted)');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Find all active activities
    console.log('Scanning database for adult activities...\n');

    const activities = await prisma.activity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        ageMin: true,
        ageMax: true,
        provider: { select: { name: true } }
      }
    });

    console.log(`Found ${activities.length} active activities\n`);

    // Identify activities to purge
    const toPurge = [];
    const byReason = {};

    for (const activity of activities) {
      const { shouldPurge, reason } = shouldPurgeActivity(activity);
      if (shouldPurge) {
        toPurge.push({ ...activity, reason });
        byReason[reason] = (byReason[reason] || 0) + 1;
      }
    }

    console.log(`Found ${toPurge.length} adult activities to purge:\n`);

    // Show breakdown by reason
    console.log('Breakdown by reason:');
    for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${reason}: ${count}`);
    }
    console.log('');

    // Show sample activities
    console.log('Sample activities to purge (first 20):');
    for (const activity of toPurge.slice(0, 20)) {
      const provider = activity.provider?.name || 'Unknown';
      console.log(`  [${provider}] ${activity.name}`);
      console.log(`    Ages: ${activity.ageMin ?? 'N/A'} - ${activity.ageMax ?? 'N/A'}`);
      console.log(`    Reason: ${activity.reason}`);
    }
    if (toPurge.length > 20) {
      console.log(`  ... and ${toPurge.length - 20} more`);
    }
    console.log('');

    if (toPurge.length === 0) {
      console.log('No adult activities found to purge.');
      return;
    }

    if (dryRun) {
      console.log('DRY RUN complete. No changes made.');
      console.log(`Would have deleted ${toPurge.length} activities.`);
      return;
    }

    // Confirm deletion
    if (!force) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question(`\nAre you sure you want to delete ${toPurge.length} adult activities? (yes/no): `, resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('Aborted.');
        return;
      }
    }

    // Perform deletion
    console.log('\nDeleting adult activities...');

    const ids = toPurge.map(a => a.id);

    // Delete in batches to avoid memory issues
    const batchSize = 100;
    let deleted = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await prisma.activity.deleteMany({
        where: { id: { in: batch } }
      });
      deleted += batch.length;
      console.log(`  Deleted ${deleted}/${ids.length} activities...`);
    }

    console.log(`\nSuccessfully deleted ${deleted} adult activities.`);

    // Show remaining count
    const remaining = await prisma.activity.count({ where: { isActive: true } });
    console.log(`Remaining active activities: ${remaining}`);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
