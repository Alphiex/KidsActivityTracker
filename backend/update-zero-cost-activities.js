#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function updateZeroCostActivities() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    // Find activities with zero cost that have registration URLs
    console.log('🔍 Finding activities with zero cost...');
    const activities = await prisma.activity.findMany({
      where: {
        cost: 0,
        registrationUrl: {
          not: null
        },
        providerId: '7023bd59-82ea-4a0d-92fc-99f9ef92f60e' // NVRC provider
      },
      take: 10 // Update 10 activities as a test
    });
    
    console.log(`Found ${activities.length} activities with zero cost\n`);
    
    let updated = 0;
    let failed = 0;
    
    for (const activity of activities) {
      try {
        console.log(`\n📊 Processing: ${activity.name} (${activity.courseId})`);
        console.log(`URL: ${activity.registrationUrl}`);
        
        // Scrape the latest details
        const details = await scrapeCourseDetails(activity.registrationUrl);
        
        if (details.cost && details.cost > 0) {
          console.log(`💰 Found cost: $${details.cost}`);
          
          // Update the activity
          await prisma.activity.update({
            where: {
              id: activity.id
            },
            data: {
              cost: details.cost,
              costIncludesTax: details.costIncludesTax !== undefined ? details.costIncludesTax : false,
              taxAmount: details.taxAmount || 0,
              lastSeenAt: new Date(),
              rawData: {
                ...activity.rawData,
                cost: details.cost,
                costIncludesTax: details.costIncludesTax,
                taxAmount: details.taxAmount
              }
            }
          });
          
          console.log('✅ Updated successfully!');
          updated++;
        } else {
          console.log('⚠️  No cost found on page');
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Failed to update ${activity.name}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updated} activities`);
    console.log(`❌ Failed: ${failed} activities`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateZeroCostActivities();