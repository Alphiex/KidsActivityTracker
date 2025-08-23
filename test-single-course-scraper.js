#!/usr/bin/env node

const { PrismaClient } = require('../generated/prisma');
const { scrapeCourseDetails } = require('./scrapers/nvrcFixedDetailScraper');

async function testSingleCourseScraper() {
  const prisma = new PrismaClient();
  
  try {
    // Get the NVRC provider
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found');
    }
    
    console.log('Testing single course scraping for 00371053...\n');
    
    // Scrape the specific course
    const courseUrl = 'https://nvrc.perfectmind.com/23734/Clients/BookMe4LandingPages/CoursesLandingPage?widgetId=a28b2c65-61af-407f-80d1-eaa58f30a94a&redirectedFromEmbededMode=False&courseId=8df45f73-8d06-4dea-ad95-71ed1b744f7c';
    const details = await scrapeCourseDetails(courseUrl);
    
    console.log('Scraped details:', JSON.stringify(details, null, 2));
    
    // Create the activity data
    const activityData = {
      providerId: provider.id,
      externalId: details.internalCourseId || details.courseId,
      name: details.name,
      category: 'Youth',
      subcategory: 'Training',
      description: details.fullDescription,
      schedule: `${details.startTime} - ${details.endTime}`,
      dates: details.dates,
      dateStart: details.startDate ? (() => {
        const [month, day, year] = details.startDate.split('/');
        return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
      })() : null,
      dateEnd: details.endDate ? (() => {
        const [month, day, year] = details.endDate.split('/');
        return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
      })() : null,
      registrationDate: details.registrationDate ? new Date(details.registrationDate) : null,
      startTime: details.startTime,
      endTime: details.endTime,
      ageMin: 11,
      ageMax: 15,
      cost: details.cost,
      costIncludesTax: details.costIncludesTax,
      spotsAvailable: details.spotsAvailable,
      totalSpots: details.totalSpots || 20,
      locationName: details.location,
      registrationUrl: courseUrl,
      registrationStatus: details.registrationStatus,
      courseId: details.courseId,  // This will be 00371053
      isActive: true,
      lastSeenAt: new Date(),
      instructor: details.instructor || 'TBD',
      fullDescription: details.fullDescription,
      fullAddress: '3625 Banff Court, North Vancouver, BC V7H 2Z8',
      hasMultipleSessions: details.sessions.length > 1,
      sessionCount: details.sessions.length,
      hasPrerequisites: details.prerequisites.length > 0
    };
    
    // Find or create location
    const location = await prisma.location.upsert({
      where: {
        name_address: {
          name: details.location,
          address: '3625 Banff Court'
        }
      },
      update: {
        latitude: 49.3315,
        longitude: -123.0424
      },
      create: {
        name: details.location,
        address: '3625 Banff Court',
        city: 'North Vancouver',
        province: 'BC',
        postalCode: 'V7H 2Z8',
        latitude: 49.3315,
        longitude: -123.0424,
        facility: 'Community Centre'
      }
    });
    
    activityData.locationId = location.id;
    
    // Upsert the activity
    const activity = await prisma.activity.upsert({
      where: {
        providerId_externalId: {
          providerId: provider.id,
          externalId: activityData.externalId
        }
      },
      update: activityData,
      create: activityData
    });
    
    console.log(`\n✅ Activity saved: ${activity.name} (ID: ${activity.id})`);
    console.log(`   Course ID: ${activity.courseId}`);
    console.log(`   Status: ${activity.registrationStatus}`);
    console.log(`   Spots: ${activity.spotsAvailable}`);
    console.log(`   Dates: ${activity.dates}`);
    
    // Handle sessions
    if (details.sessions.length > 0) {
      // Delete existing sessions
      await prisma.activitySession.deleteMany({
        where: { activityId: activity.id }
      });
      
      // Create new sessions
      for (const session of details.sessions) {
        await prisma.activitySession.create({
          data: {
            activityId: activity.id,
            sessionNumber: session.sessionNumber,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            location: session.subLocation || details.location,
            dayOfWeek: session.dayOfWeek
          }
        });
      }
      console.log(`   Sessions: ${details.sessions.length} created`);
    }
    
    // Handle required extras
    if (details.requiredExtras.length > 0) {
      // Delete existing extras
      await prisma.activityPrerequisite.deleteMany({
        where: { activityId: activity.id }
      });
      
      // Create as prerequisites (since we're reusing the table)
      for (const extra of details.requiredExtras) {
        await prisma.activityPrerequisite.create({
          data: {
            activityId: activity.id,
            name: extra.name,
            description: `Required: ${extra.cost}`,
            isRequired: extra.required
          }
        });
      }
      console.log(`   Required extras: ${details.requiredExtras.length} created`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run with DATABASE_URL
testSingleCourseScraper();