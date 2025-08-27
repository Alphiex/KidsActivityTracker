require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedActivityTypes() {
  console.log('🌱 Seeding Activity Types and Subtypes...\n');
  
  // Load the master list
  const masterListPath = path.join(__dirname, '../../ACTIVITY_TYPES_MASTER_LIST.json');
  const masterList = JSON.parse(fs.readFileSync(masterListPath, 'utf8'));
  
  let typeCount = 0;
  let subtypeCount = 0;
  
  try {
    // Process each activity type
    for (let i = 0; i < masterList.activityTypes.length; i++) {
      const typeData = masterList.activityTypes[i];
      
      // Convert type name to code (e.g., "Swimming & Aquatics" -> "swimming-aquatics")
      const code = typeData.type.toLowerCase()
        .replace(/[&]/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Create or update the activity type
      const activityType = await prisma.activityType.upsert({
        where: { code },
        update: {
          name: typeData.type,
          description: typeData.description,
          displayOrder: i + 1
        },
        create: {
          code,
          name: typeData.type,
          description: typeData.description,
          displayOrder: i + 1
        }
      });
      
      console.log(`✅ Created/Updated type: ${activityType.name}`);
      typeCount++;
      
      // Process subtypes for this type
      for (let j = 0; j < typeData.subtypes.length; j++) {
        const subtypeName = typeData.subtypes[j];
        
        // Convert subtype name to code
        const subtypeCode = subtypeName.toLowerCase()
          .replace(/[&]/g, 'and')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        // Check if subtype already exists for this type
        const existing = await prisma.activitySubtype.findFirst({
          where: {
            activityTypeId: activityType.id,
            code: subtypeCode
          }
        });
        
        if (existing) {
          // Update existing
          await prisma.activitySubtype.update({
            where: { id: existing.id },
            data: { name: subtypeName }
          });
        } else {
          // Create new
          await prisma.activitySubtype.create({
            data: {
              activityTypeId: activityType.id,
              code: subtypeCode,
              name: subtypeName
            }
          });
        }
        
        subtypeCount++;
      }
      
      console.log(`   Added ${typeData.subtypes.length} subtypes`);
    }
    
    // Add the special "Other Activity" type if it doesn't exist
    const otherType = await prisma.activityType.upsert({
      where: { code: 'other-activity' },
      update: {
        name: 'Other Activity',
        description: 'Activities that have not been categorized yet',
        displayOrder: 999
      },
      create: {
        code: 'other-activity',
        name: 'Other Activity',
        description: 'Activities that have not been categorized yet',
        displayOrder: 999
      }
    });
    
    // Add "Other" subtype for the Other Activity type
    const existingOther = await prisma.activitySubtype.findFirst({
      where: {
        activityTypeId: otherType.id,
        code: 'other'
      }
    });
    
    if (!existingOther) {
      await prisma.activitySubtype.create({
        data: {
          activityTypeId: otherType.id,
          code: 'other',
          name: 'Other',
          description: 'Uncategorized activities'
        }
      });
    }
    
    console.log(`\n✅ Created/Updated special type: Other Activity`);
    
    console.log(`\n✨ Successfully seeded ${typeCount + 1} activity types`);
    console.log(`✨ Successfully seeded ${subtypeCount + 1} activity subtypes`);
    
    // Verify counts
    const totalTypes = await prisma.activityType.count();
    const totalSubtypes = await prisma.activitySubtype.count();
    
    console.log(`\n📊 Total activity types in database: ${totalTypes}`);
    console.log(`📊 Total activity subtypes in database: ${totalSubtypes}`);
    
    // Show sample
    const sampleTypes = await prisma.activityType.findMany({
      take: 5,
      include: {
        subtypes: {
          take: 3
        }
      },
      orderBy: { displayOrder: 'asc' }
    });
    
    console.log('\n📋 Sample Activity Types:');
    sampleTypes.forEach(type => {
      console.log(`\n${type.displayOrder}. ${type.name} (${type.code})`);
      type.subtypes.forEach(sub => {
        console.log(`   - ${sub.name}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error seeding activity types:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedActivityTypes()
  .then(() => {
    console.log('\n✅ Activity type seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Activity type seeding failed:', error);
    process.exit(1);
  });