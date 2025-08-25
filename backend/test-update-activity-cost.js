#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function updateActivityCost() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity'
      }
    }
  });
  
  try {
    // First check if activity 00369211 exists
    console.log('🔍 Checking activity 00369211...');
    const activity = await prisma.activity.findFirst({
      where: {
        courseId: '00369211'
      }
    });
    
    if (!activity) {
      console.log('❌ Activity 00369211 not found in database');
      return;
    }
    
    console.log('✅ Found activity:', {
      name: activity.name,
      courseId: activity.courseId,
      currentCost: activity.cost,
      externalId: activity.externalId
    });
    
    // Scrape the latest details
    console.log('\n🌐 Scraping latest details from NVRC website...');
    const courseUrl = activity.registrationUrl || `https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&courseId=${activity.externalId}`;
    
    const details = await scrapeCourseDetails(courseUrl);
    console.log('📊 Scraped details:', {
      cost: details.cost,
      costIncludesTax: details.costIncludesTax,
      taxAmount: details.taxAmount
    });
    
    // Update the activity with the new cost
    console.log('\n💾 Updating activity in database...');
    const updated = await prisma.activity.update({
      where: {
        id: activity.id
      },
      data: {
        cost: details.cost || 0,
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
    
    console.log('✅ Activity updated successfully!');
    console.log('New cost:', updated.cost);
    console.log('Cost includes tax:', updated.costIncludesTax);
    console.log('Tax amount:', updated.taxAmount);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateActivityCost();