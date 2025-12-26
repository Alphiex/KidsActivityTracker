#!/usr/bin/env node

/**
 * Test script for NVRC scraper
 * This script tests the scraper locally and saves activities to the database
 */

require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('../generated/prisma');
const path = require('path');
const NVRCScraper = require(path.join(__dirname, '../scrapers/providers/NVRCScraper'));

const prisma = new PrismaClient();

// NVRC scraper configuration
const scraperConfig = {
  code: 'nvrc',
  name: 'North Vancouver Recreation & Culture',
  provider: 'nvrc',
  baseUrl: 'https://ca.apm.activecommunities.com/northvanrec/Activity_Search?detailskeyword=&IsAdvanced=True&ddlSortBy=Activity+name&ActivityCategoryID=0&DaysOfWeek=0&SearchFor=2&SearchLevelID=2&maxAge=100&NumberOfItemsPerPage=999&IsSearch=true',
  platform: 'PerfectMind',
  scraperConfig: {
    type: 'widget',
    sections: [
      { name: 'All Activities', selector: '.activity-list-item' }
    ],
    waitTime: 5000,
    maxRetries: 3,
    timeout: 60000,
    enableDetailEnhancement: true,
    parallel: {
      enabled: true,
      maxConcurrent: 5
    },
    cacheResults: true,
    cacheExpiry: 3600000
  },
  categoryMapping: {
    'Swimming': ['Swimming', 'Aquatic Leadership', 'Aquatic Activities'],
    'Sports': ['Sports', 'Ball Sports', 'Team Sports', 'Racquet Sports'],
    'Arts': ['Arts', 'Art', 'Craft'],
    'Music': ['Music', 'Instruments', 'Voice'],
    'Dance': ['Dance', 'Ballet', 'Hip Hop'],
    'Martial Arts': ['Martial Arts', 'Karate', 'Kung Fu'],
    'Education': ['Education', 'STEM', 'Languages'],
    'Camps': ['Camps', 'Day Camp', 'Spring Break Camp'],
    'Outdoor': ['Outdoor', 'Nature', 'Adventure']
  }
};

async function testScraper() {
  console.log('🚀 Starting NVRC scraper test...\n');

  try {
    // Create scraper instance directly
    const scraper = new NVRCScraper(scraperConfig);

    console.log('📊 Configuration:', JSON.stringify(scraperConfig, null, 2), '\n');

    // Run the scraper
    console.log('🔄 Running scraper...\n');
    const result = await scraper.scrape();

    // Display results
    console.log(`✅ Scraping complete!\n`);
    console.log(`📈 Statistics:`);
    console.log(`   - Total activities found: ${result.activities.length}`);
    console.log(`   - Processing time: ${result.stats.duration}ms`);
    console.log(`   - Sections processed: ${result.stats.sectionsProcessed || 0}`);
    console.log(`   - Activities saved: ${result.stats.savedToDatabase || 0}`);
    console.log(`   - Duplicates skipped: ${result.stats.duplicatesSkipped || 0}\n`);

    if (result.activities.length > 0) {
      console.log('📝 Sample activities:');
      result.activities.slice(0, 3).forEach((activity, idx) => {
        console.log(`\n   Activity ${idx + 1}:`);
        console.log(`   - Name: ${activity.name}`);
        console.log(`   - Type: ${activity.activityType}`);
        console.log(`   - Age: ${activity.ageRange?.min || 0}-${activity.ageRange?.max || 18}`);
        console.log(`   - Price: $${activity.price || 0}`);
        console.log(`   - Location: ${activity.location}`);
        console.log(`   - Status: ${activity.registrationStatus}`);
      });

      // Save to database
      console.log('\n💾 Saving activities to database...');

      let savedCount = 0;
      let errorCount = 0;

      for (const activity of result.activities) {
        try {
          // Check if activity already exists
          const existing = await prisma.activity.findFirst({
            where: {
              externalId: activity.externalId || activity.id
            }
          });

          if (existing) {
            // Update existing activity
            await prisma.activity.update({
              where: { id: existing.id },
              data: {
                name: activity.name,
                description: activity.description || '',
                cost: activity.price || 0,
                ageMin: activity.ageRange?.min || 0,
                ageMax: activity.ageRange?.max || 18,
                location: activity.location || 'North Vancouver',
                address: activity.address,
                startDate: activity.startDate ? new Date(activity.startDate) : new Date(),
                endDate: activity.endDate ? new Date(activity.endDate) : new Date(),
                registrationUrl: activity.registrationUrl,
                registrationStatus: activity.registrationStatus || 'Open',
                spotsAvailable: activity.spotsAvailable,
                activityType: activity.activityType,
                provider: 'North Vancouver Recreation & Culture',
                updatedAt: new Date()
              }
            });
          } else {
            // Create new activity
            await prisma.activity.create({
              data: {
                externalId: activity.externalId || activity.id,
                name: activity.name,
                description: activity.description || '',
                cost: activity.price || 0,
                ageMin: activity.ageRange?.min || 0,
                ageMax: activity.ageRange?.max || 18,
                location: activity.location || 'North Vancouver',
                address: activity.address,
                startDate: activity.startDate ? new Date(activity.startDate) : new Date(),
                endDate: activity.endDate ? new Date(activity.endDate) : new Date(),
                registrationUrl: activity.registrationUrl,
                registrationStatus: activity.registrationStatus || 'Open',
                spotsAvailable: activity.spotsAvailable,
                activityType: activity.activityType,
                provider: 'North Vancouver Recreation & Culture',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
          }
          savedCount++;

          if (savedCount % 10 === 0) {
            process.stdout.write(`\r   Saved ${savedCount}/${result.activities.length} activities...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`\n   ❌ Error saving activity "${activity.name}":`, error.message);
        }
      }

      console.log(`\n\n✅ Database update complete:`);
      console.log(`   - Activities saved/updated: ${savedCount}`);
      console.log(`   - Errors: ${errorCount}`);
    } else {
      console.log('⚠️  No activities found. The scraper may need updating.');
    }

  } catch (error) {
    console.error('❌ Scraper error:', error);
    console.error('\nStack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testScraper().catch(console.error);