/**
 * Script to fix activities with corrupt age data.
 *
 * This script finds activities where ageMin or ageMax are obviously wrong
 * (e.g., 604, 501, 987 - which are not real ages) and either:
 * 1. Extracts correct age from activity name
 * 2. Sets to null if no age info available
 *
 * Usage: node scripts/fix-corrupt-ages.js [--dry-run]
 *   --dry-run: Show what would be fixed without actually fixing
 */

const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

// Extract age from activity name
function extractAgeFromName(name) {
  if (!name) return null;

  // Pattern priority (most specific first)
  const patterns = [
    // "(4-10Y)" or "(3-5Y)" format
    { regex: /\((\d+)\s*-\s*(\d+)\s*Y\)/i, type: 'range' },
    // "(5-13yrs)" or "(5-13 yrs)"
    { regex: /\((\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)\)/i, type: 'range' },
    // "5-13 months" or "6-24 months"
    { regex: /(\d+)\s*-\s*(\d+)\s*(?:months?|mos?)\b/i, type: 'months' },
    // "(5-13)" just numbers in parentheses
    { regex: /\((\d+)\s*-\s*(\d+)\)/, type: 'range' },
    // "Kids 5-12" or "Youth 13-17"
    { regex: /(?:kids?|youth|children|teens?)\s*(?:\()?(\d+)\s*-\s*(\d+)/i, type: 'range' },
    // "5-13yrs" or "5-13 years"
    { regex: /(\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)/i, type: 'range' },
    // "ages 5-13"
    { regex: /ages?\s*(\d+)\s*-\s*(\d+)/i, type: 'range' },
    // "18Y+" or "12Y+"
    { regex: /(\d+)\s*Y\s*\+/i, type: 'plus' },
    // "12 yrs+" or "15 yrs+"
    { regex: /\((\d+)\s*(?:yrs?|years?)\s*\+\)/i, type: 'plus' },
    // "3+" at end of name or with dash
    { regex: /[-–]\s*(\d+)\s*\+\s*$/i, type: 'plus' },
    // "3+" standalone
    { regex: /\b(\d+)\s*\+\b/, type: 'plus' }
  ];

  for (const { regex, type } of patterns) {
    const match = name.match(regex);
    if (match) {
      if (type === 'months') {
        // Convert months to years (approximate)
        const minMonths = parseInt(match[1]);
        const maxMonths = parseInt(match[2]);
        return {
          min: Math.floor(minMonths / 12),
          max: Math.min(Math.ceil(maxMonths / 12), 18)
        };
      } else if (type === 'range') {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        // Validate it looks like an age range
        if (min >= 0 && min <= 99 && max <= 99 && min <= max) {
          return { min, max: Math.min(max, 18) };
        }
      } else if (type === 'plus') {
        const min = parseInt(match[1]);
        if (min >= 0 && min <= 18) {
          return { min, max: 18 };
        }
      }
    }
  }

  // Check for age keywords
  const ageKeywords = {
    'infant': { min: 0, max: 1 },
    'baby': { min: 0, max: 2 },
    'babies': { min: 0, max: 2 },
    'toddler': { min: 1, max: 3 },
    'preschool': { min: 3, max: 5 },
    'pre-school': { min: 3, max: 5 },
    'parent and tot': { min: 0, max: 3 },
    'parent & tot': { min: 0, max: 3 },
    'mom and tot': { min: 0, max: 3 },
    'kindergarten': { min: 4, max: 6 }
  };

  const lowerName = name.toLowerCase();
  for (const [keyword, range] of Object.entries(ageKeywords)) {
    if (lowerName.includes(keyword)) {
      return range;
    }
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('FIX CORRUPT AGES SCRIPT');
  console.log(dryRun ? '(DRY RUN - No changes will be made)' : '(LIVE MODE - Activities will be updated)');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Find activities with corrupt ages (ageMin or ageMax > 100)
    console.log('Finding activities with corrupt age data...\n');

    const activities = await prisma.activity.findMany({
      where: {
        isActive: true,
        OR: [
          { ageMin: { gt: 100 } },
          { ageMax: { gt: 100 } }
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

    console.log(`Found ${activities.length} activities with corrupt age data\n`);

    if (activities.length === 0) {
      console.log('No activities with corrupt ages found.');
      return;
    }

    // Process activities
    const toFix = [];
    const toNullify = [];

    for (const activity of activities) {
      const extracted = extractAgeFromName(activity.name);
      if (extracted) {
        toFix.push({
          id: activity.id,
          name: activity.name,
          provider: activity.provider?.name,
          oldAgeMin: activity.ageMin,
          oldAgeMax: activity.ageMax,
          newAgeMin: extracted.min,
          newAgeMax: extracted.max
        });
      } else {
        toNullify.push({
          id: activity.id,
          name: activity.name,
          provider: activity.provider?.name,
          oldAgeMin: activity.ageMin,
          oldAgeMax: activity.ageMax
        });
      }
    }

    console.log(`Can extract correct age for ${toFix.length} activities`);
    console.log(`Will set ages to null for ${toNullify.length} activities\n`);

    // Show sample fixes
    if (toFix.length > 0) {
      console.log('Sample fixes (first 15):');
      for (const activity of toFix.slice(0, 15)) {
        console.log(`  [${activity.provider || 'Unknown'}] ${activity.name}`);
        console.log(`    ${activity.oldAgeMin}-${activity.oldAgeMax} -> ${activity.newAgeMin}-${activity.newAgeMax}`);
      }
      if (toFix.length > 15) {
        console.log(`  ... and ${toFix.length - 15} more`);
      }
      console.log('');
    }

    // Show sample nullifications
    if (toNullify.length > 0) {
      console.log('Sample nullifications (first 10):');
      for (const activity of toNullify.slice(0, 10)) {
        console.log(`  [${activity.provider || 'Unknown'}] ${activity.name}`);
        console.log(`    ${activity.oldAgeMin}-${activity.oldAgeMax} -> null-null`);
      }
      if (toNullify.length > 10) {
        console.log(`  ... and ${toNullify.length - 10} more`);
      }
      console.log('');
    }

    if (dryRun) {
      console.log('DRY RUN complete. No changes made.');
      console.log(`Would have fixed ${toFix.length} activities.`);
      console.log(`Would have nullified ${toNullify.length} activities.`);
      return;
    }

    // Perform fixes
    console.log('Fixing activities...');

    let fixed = 0;
    for (const activity of toFix) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          ageMin: activity.newAgeMin,
          ageMax: activity.newAgeMax
        }
      });
      fixed++;
      if (fixed % 100 === 0) {
        console.log(`  Fixed ${fixed}/${toFix.length}...`);
      }
    }

    let nullified = 0;
    for (const activity of toNullify) {
      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          ageMin: null,
          ageMax: null
        }
      });
      nullified++;
      if (nullified % 100 === 0) {
        console.log(`  Nullified ${nullified}/${toNullify.length}...`);
      }
    }

    console.log(`\nSuccessfully fixed ${fixed} activities.`);
    console.log(`Successfully nullified ${nullified} activities.`);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
