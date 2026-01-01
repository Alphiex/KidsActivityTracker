/**
 * Delete duplicate activity types from the database
 *
 * This script removes duplicate activity types that were created incorrectly.
 * For example, "Swimming" should be mapped to "Swimming & Aquatics".
 *
 * Usage:
 *   node server/scripts/maintenance/delete-duplicate-activity-types.js
 *
 * For production, run with DATABASE_URL set to the production database:
 *   DATABASE_URL=<prod-connection-string> node server/scripts/maintenance/delete-duplicate-activity-types.js
 */

// Note: Run with: cd server && node scripts/maintenance/delete-duplicate-activity-types.js
// Or with explicit env: DATABASE_URL="..." node scripts/maintenance/delete-duplicate-activity-types.js
require('dotenv').config();
const { PrismaClient } = require('../../generated/prisma');

const prisma = new PrismaClient();

// Duplicates to remove (these should be mapped to the canonical name)
const DUPLICATES_TO_REMOVE = [
  'Swimming',  // Should be "Swimming & Aquatics"
];

async function deleteDuplicateActivityTypes() {
  console.log('=== Delete Duplicate Activity Types ===\n');

  try {
    // First, list all activity types
    const allTypes = await prisma.activityType.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });

    console.log('Current activity types:');
    allTypes.forEach(type => {
      const isDuplicate = DUPLICATES_TO_REMOVE.includes(type.name);
      console.log(`  ${isDuplicate ? '[DUPLICATE] ' : ''}${type.name} (${type._count.activities} activities)`);
    });
    console.log('');

    // Find duplicates
    const duplicatesToDelete = allTypes.filter(type => DUPLICATES_TO_REMOVE.includes(type.name));

    if (duplicatesToDelete.length === 0) {
      console.log('No duplicates found to delete.');
      return;
    }

    console.log(`Found ${duplicatesToDelete.length} duplicate(s) to delete:\n`);

    for (const duplicate of duplicatesToDelete) {
      console.log(`Processing: "${duplicate.name}" (ID: ${duplicate.id})`);
      console.log(`  - Has ${duplicate._count.activities} linked activities`);

      if (duplicate._count.activities > 0) {
        // Find the correct activity type to migrate to
        const correctName = getCorrectActivityTypeName(duplicate.name);
        const correctType = allTypes.find(t => t.name === correctName);

        if (correctType) {
          console.log(`  - Migrating activities to "${correctName}" (ID: ${correctType.id})`);

          // Update activities to point to the correct type
          const updateResult = await prisma.activity.updateMany({
            where: { activityTypeId: duplicate.id },
            data: { activityTypeId: correctType.id }
          });

          console.log(`  - Migrated ${updateResult.count} activities`);
        } else {
          console.log(`  - WARNING: Cannot find correct type "${correctName}" to migrate to`);
          console.log(`  - Skipping deletion to prevent data loss`);
          continue;
        }
      }

      // Delete any subtypes first
      const deletedSubtypes = await prisma.activitySubtype.deleteMany({
        where: { activityTypeId: duplicate.id }
      });
      if (deletedSubtypes.count > 0) {
        console.log(`  - Deleted ${deletedSubtypes.count} subtypes`);
      }

      // Delete the duplicate activity type
      await prisma.activityType.delete({
        where: { id: duplicate.id }
      });
      console.log(`  - Deleted activity type "${duplicate.name}"`);
      console.log('');
    }

    // Show final state
    const finalTypes = await prisma.activityType.findMany({
      orderBy: { name: 'asc' }
    });
    console.log('Final activity types:');
    finalTypes.forEach(type => {
      console.log(`  ${type.name}`);
    });

    console.log('\n=== Cleanup complete ===');
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function getCorrectActivityTypeName(duplicateName) {
  const mappings = {
    'Swimming': 'Swimming & Aquatics',
  };
  return mappings[duplicateName] || duplicateName;
}

// Run the script
deleteDuplicateActivityTypes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
