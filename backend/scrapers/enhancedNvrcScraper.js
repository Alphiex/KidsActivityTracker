const puppeteer = require('puppeteer');
const { PrismaClient } = require('../generated/prisma');

class EnhancedNVRCScraper {
  constructor() {
    this.prisma = new PrismaClient();
    this.providerId = null;
    this.scrapedActivities = new Set();
    this.stats = {
      found: 0,
      created: 0,
      updated: 0,
      deactivated: 0,
      purged: 0,
      errors: []
    };
  }

  async initialize() {
    // Get or create NVRC provider
    this.provider = await this.prisma.provider.findUnique({
      where: { name: 'NVRC' }
    });
    
    if (!this.provider) {
      throw new Error('NVRC provider not found');
    }
    
    this.providerId = this.provider.id;
  }

  async run() {
    const scraperRun = await this.prisma.scraperRun.create({
      data: {
        providerId: this.providerId,
        status: 'running'
      }
    });

    try {
      console.log('🚀 Starting enhanced NVRC scraper...');
      
      // Step 1: Mark all activities as inactive
      await this.markAllActivitiesInactive();
      
      // Step 2: Scrape activities
      await this.scrapeActivities();
      
      // Step 3: Purge old inactive activities
      await this.purgeOldActivities();
      
      // Step 4: Update scraper run stats
      await this.prisma.scraperRun.update({
        where: { id: scraperRun.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          activitiesFound: this.stats.found,
          activitiesCreated: this.stats.created,
          activitiesUpdated: this.stats.updated,
          activitiesDeactivated: this.stats.deactivated,
          activitiesPurged: this.stats.purged,
          logs: this.stats
        }
      });
      
      console.log('✅ Scraping completed successfully!');
      console.log('📊 Stats:', this.stats);
      
    } catch (error) {
      console.error('❌ Scraper failed:', error);
      
      await this.prisma.scraperRun.update({
        where: { id: scraperRun.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message,
          logs: this.stats
        }
      });
      
      throw error;
    }
  }

  async markAllActivitiesInactive() {
    console.log('📌 Marking all activities as inactive...');
    
    const result = await this.prisma.activity.updateMany({
      where: { 
        providerId: this.providerId,
        isActive: true
      },
      data: { isActive: false }
    });
    
    this.stats.deactivated = result.count;
    console.log(`   Marked ${result.count} activities as inactive`);
  }

  async scrapeActivities() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate to NVRC programs page
      await page.goto('https://www.nvrc.ca/programs-memberships/find-program', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Wait for and process activities
      await page.waitForSelector('.pm-activity-category-selector', { timeout: 30000 });
      
      // Get all category links
      const categories = await page.evaluate(() => {
        const cats = document.querySelectorAll('.pm-activity-category-selector .category-item');
        return Array.from(cats).map(cat => ({
          name: cat.textContent.trim(),
          onclick: cat.getAttribute('onclick')
        }));
      });
      
      console.log(`📂 Found ${categories.length} categories to scrape`);
      
      // Process each category
      for (const category of categories) {
        console.log(`\n🔍 Scraping category: ${category.name}`);
        
        // Click category
        await page.evaluate((onclick) => {
          eval(onclick);
        }, category.onclick);
        
        // Wait for results
        await page.waitForTimeout(3000);
        
        // Scrape activities in this category
        await this.scrapeCategoryActivities(page, category.name);
      }
      
    } finally {
      await browser.close();
    }
  }

  async scrapeCategoryActivities(page, categoryName) {
    // Check if we need to handle pagination
    let hasMore = true;
    let retries = 0;
    
    while (hasMore && retries < 3) {
      try {
        // Get all activity rows
        const activities = await page.evaluate(() => {
          const rows = document.querySelectorAll('.events-table tr.events-row');
          return Array.from(rows).map(row => {
            const getTextContent = (selector) => row.querySelector(selector)?.textContent?.trim() || '';
            const getHref = (selector) => row.querySelector(selector)?.href || '';
            
            return {
              name: getTextContent('.events-row__title a'),
              courseId: getTextContent('.events-row__barcode'),
              dates: getTextContent('.events-row__dates'),
              schedule: getTextContent('.events-row__schedule'),
              ageRange: getTextContent('.events-row__ages'),
              location: getTextContent('.events-row__location'),
              cost: getTextContent('.events-row__cost'),
              spots: getTextContent('.events-row__spots'),
              registrationUrl: getHref('.events-row__register a'),
              alert: getTextContent('.events-row__alert')
            };
          });
        });
        
        console.log(`   Found ${activities.length} activities`);
        
        // Process each activity
        for (const activityData of activities) {
          if (activityData.courseId) {
            await this.processActivity(activityData, categoryName);
          }
        }
        
        // Check for "Load More" button
        hasMore = await page.evaluate(() => {
          const loadMore = document.querySelector('button.load-more:not(.disabled)');
          if (loadMore) {
            loadMore.click();
            return true;
          }
          return false;
        });
        
        if (hasMore) {
          await page.waitForTimeout(2000);
        }
        
      } catch (error) {
        console.error(`   Error scraping category ${categoryName}:`, error.message);
        retries++;
        if (retries >= 3) {
          this.stats.errors.push({
            category: categoryName,
            error: error.message
          });
        }
      }
    }
  }

  async processActivity(activityData, category) {
    try {
      this.stats.found++;
      
      // Use courseId as externalId for unique identification
      const externalId = activityData.courseId;
      
      // Track that we've seen this activity
      this.scrapedActivities.add(externalId);
      
      // Parse activity data
      const parsedData = this.parseActivityData(activityData, category);
      
      // Check if activity exists
      const existingActivity = await this.prisma.activity.findUnique({
        where: {
          providerId_externalId: {
            providerId: this.providerId,
            externalId: externalId
          }
        }
      });
      
      if (existingActivity) {
        // Update existing activity
        await this.updateActivity(existingActivity.id, parsedData);
      } else {
        // Create new activity
        await this.createActivity(externalId, parsedData);
      }
      
    } catch (error) {
      console.error(`   Error processing activity ${activityData.name}:`, error.message);
      this.stats.errors.push({
        activity: activityData.name,
        courseId: activityData.courseId,
        error: error.message
      });
    }
  }

  parseActivityData(data, category) {
    // Parse age range
    let ageMin = null, ageMax = null;
    const ageMatch = data.ageRange.match(/(\d+)\s*[-–]\s*(\d+)\s*yr?s?/i);
    if (ageMatch) {
      ageMin = parseInt(ageMatch[1]);
      ageMax = parseInt(ageMatch[2]);
    }
    
    // Parse cost (with improved regex)
    let cost = 0;
    if (data.cost) {
      const costMatch = data.cost.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
      if (costMatch) {
        cost = parseFloat(costMatch[1].replace(/,/g, ''));
      }
    }
    
    // Parse spots
    let spotsAvailable = null;
    if (data.spots) {
      const spotsMatch = data.spots.match(/(\d+)\s*spot/i);
      if (spotsMatch) {
        spotsAvailable = parseInt(spotsMatch[1]);
      }
    }
    
    // Parse dates
    let dateStart = null, dateEnd = null;
    if (data.dates) {
      const dateMatch = data.dates.match(/(\w+\s+\d+)\s*[-–]\s*(\w+\s+\d+),?\s*(\d{4})/);
      if (dateMatch) {
        const year = dateMatch[3];
        dateStart = new Date(`${dateMatch[1]}, ${year}`);
        dateEnd = new Date(`${dateMatch[2]}, ${year}`);
      }
    }
    
    // Extract days of week from schedule
    const dayOfWeek = [];
    const dayPattern = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g;
    const dayMatches = data.schedule.match(dayPattern);
    if (dayMatches) {
      dayOfWeek.push(...new Set(dayMatches));
    }
    
    return {
      name: data.name,
      category: category,
      schedule: data.schedule,
      dateStart: dateStart,
      dateEnd: dateEnd,
      ageMin: ageMin,
      ageMax: ageMax,
      cost: cost,
      spotsAvailable: spotsAvailable,
      locationName: data.location,
      registrationUrl: data.registrationUrl,
      courseId: data.courseId,
      dayOfWeek: dayOfWeek,
      isActive: true,
      lastSeenAt: new Date(),
      rawData: data
    };
  }

  async createActivity(externalId, data) {
    try {
      await this.prisma.activity.create({
        data: {
          ...data,
          providerId: this.providerId,
          externalId: externalId
        }
      });
      
      this.stats.created++;
      console.log(`   ✅ Created: ${data.name}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to create activity:`, error.message);
      throw error;
    }
  }

  async updateActivity(activityId, data) {
    try {
      // Get current activity data for comparison
      const currentActivity = await this.prisma.activity.findUnique({
        where: { id: activityId }
      });
      
      // Track changes for history
      const changedFields = [];
      const significantFields = ['cost', 'spotsAvailable', 'dateStart', 'dateEnd', 'schedule'];
      
      for (const field of significantFields) {
        if (JSON.stringify(currentActivity[field]) !== JSON.stringify(data[field])) {
          changedFields.push(field);
        }
      }
      
      // Update activity
      await this.prisma.activity.update({
        where: { id: activityId },
        data: data
      });
      
      // Log history if significant changes
      if (changedFields.length > 0) {
        await this.prisma.activityHistory.create({
          data: {
            activityId: activityId,
            changeType: 'updated',
            previousData: currentActivity,
            newData: data,
            changedFields: changedFields
          }
        });
      }
      
      this.stats.updated++;
      console.log(`   🔄 Updated: ${data.name}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to update activity:`, error.message);
      throw error;
    }
  }

  async purgeOldActivities() {
    console.log('\n🗑️  Purging old inactive activities...');
    
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    // Find activities to purge
    const activitiesToPurge = await this.prisma.activity.findMany({
      where: {
        providerId: this.providerId,
        isActive: false,
        lastSeenAt: { lt: twelveMonthsAgo }
      },
      select: { id: true, name: true }
    });
    
    console.log(`   Found ${activitiesToPurge.length} activities to purge`);
    
    // Delete in batches
    for (const activity of activitiesToPurge) {
      try {
        await this.prisma.activity.delete({
          where: { id: activity.id }
        });
        this.stats.purged++;
      } catch (error) {
        console.error(`   Failed to purge ${activity.name}:`, error.message);
      }
    }
    
    console.log(`   Purged ${this.stats.purged} activities`);
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }
}

// Run the scraper
async function main() {
  const scraper = new EnhancedNVRCScraper();
  
  try {
    await scraper.initialize();
    await scraper.run();
  } catch (error) {
    console.error('Scraper failed:', error);
    process.exit(1);
  } finally {
    await scraper.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = EnhancedNVRCScraper;