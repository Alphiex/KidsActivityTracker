const NVRCWorkingHierarchicalScraper = require('./scrapers/nvrcWorkingHierarchicalScraper');
const { PrismaClient } = require('./generated/prisma');

// Enhanced date parsing function
function parseDateRange(dateStr, year = new Date().getFullYear()) {
  if (!dateStr) {
    return null;
  }

  // Handle various date formats
  const patterns = [
    // "Jul 30 - Aug 27" (different months)
    {
      regex: /(\w{3})\s+(\d{1,2})\s*-\s*(\w{3})\s+(\d{1,2})/,
      handler: (match) => {
        const startMonth = match[1];
        const startDay = match[2];
        const endMonth = match[3];
        const endDay = match[4];
        
        const start = new Date(`${startMonth} ${startDay}, ${year}`);
        const end = new Date(`${endMonth} ${endDay}, ${year}`);
        
        // If end date is before start date, it might be next year
        if (end < start) {
          end.setFullYear(year + 1);
        }
        
        return { start, end };
      }
    },
    // "Aug 5 - 8" (same month)
    {
      regex: /(\w{3})\s+(\d{1,2})\s*-\s*(\d{1,2})/,
      handler: (match) => {
        const month = match[1];
        const startDay = match[2];
        const endDay = match[3];
        
        const start = new Date(`${month} ${startDay}, ${year}`);
        const end = new Date(`${month} ${endDay}, ${year}`);
        
        return { start, end };
      }
    },
    // "July 14-18" (month name with days)
    {
      regex: /(\w+)\s+(\d{1,2})\s*-\s*(\d{1,2})/,
      handler: (match) => {
        const month = match[1];
        const startDay = match[2];
        const endDay = match[3];
        
        const start = new Date(`${month} ${startDay}, ${year}`);
        const end = new Date(`${month} ${endDay}, ${year}`);
        
        return { start, end };
      }
    },
    // Single date "Aug 15"
    {
      regex: /(\w{3,})\s+(\d{1,2})(?!\s*-)/,
      handler: (match) => {
        const month = match[1];
        const day = match[2];
        
        const date = new Date(`${month} ${day}, ${year}`);
        return { start: date, end: date };
      }
    }
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = dateStr.match(pattern.regex);
    if (match) {
      try {
        const result = pattern.handler(match);
        // Validate dates
        if (result.start && !isNaN(result.start.getTime()) && 
            result.end && !isNaN(result.end.getTime())) {
          return result;
        }
      } catch (e) {
        console.log(`Date parsing error for "${dateStr}":`, e.message);
      }
    }
  }

  return null;
}

async function runScraper() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('🚀 Starting NVRC Working Hierarchical Scraper with fixed date parsing...');
    
    // Get provider from database
    const provider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    if (!provider) {
      throw new Error('NVRC provider not found in database');
    }
    
    console.log(`📍 Found provider: ${provider.name} (${provider.id})`);
    
    const scraper = new NVRCWorkingHierarchicalScraper();
    
    console.log('🔍 Scraping activities...');
    const activities = await scraper.scrape();
    
    console.log(`✅ Scraped ${activities.length} activities`);
    
    // Save activities to database
    let saved = 0;
    let errors = 0;
    let dateErrors = 0;
    
    for (const activity of activities) {
      try {
        // Parse the date range properly
        let dateStart = null;
        let dateEnd = null;
        
        if (activity.dates) {
          const dateRange = parseDateRange(activity.dates);
          if (dateRange) {
            dateStart = dateRange.start;
            dateEnd = dateRange.end;
          } else {
            dateErrors++;
            console.log(`⚠️ Could not parse date "${activity.dates}" for ${activity.name}`);
            // Skip this activity if we can't parse dates
            continue;
          }
        } else if (activity.dateRange?.start && activity.dateRange?.end) {
          // Use existing dateRange if already parsed correctly
          const start = new Date(activity.dateRange.start);
          const end = new Date(activity.dateRange.end);
          
          // Check if these are valid dates (not the scrape timestamp)
          const now = new Date();
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          
          if (start > oneHourAgo && end > oneHourAgo && 
              Math.abs(start.getTime() - end.getTime()) < 1000) {
            // These look like scrape timestamps, try to parse from dates field
            if (activity.dates) {
              const dateRange = parseDateRange(activity.dates);
              if (dateRange) {
                dateStart = dateRange.start;
                dateEnd = dateRange.end;
              }
            }
          } else {
            dateStart = start;
            dateEnd = end;
          }
        }
        
        // If we still don't have valid dates, skip this activity
        if (!dateStart || !dateEnd || isNaN(dateStart.getTime()) || isNaN(dateEnd.getTime())) {
          dateErrors++;
          console.log(`⚠️ Skipping ${activity.name} - invalid dates`);
          continue;
        }
        
        // Prepare activity data
        const activityData = {
          providerId: provider.id,
          externalId: activity.id || activity.courseId || `${activity.name}-${dateStart.toISOString()}`,
          name: activity.name,
          category: activity.category || 'Uncategorized',
          subcategory: activity.subcategory || null,
          description: activity.description || activity.alert || null,
          schedule: activity.schedule || null,
          dateStart: dateStart,
          dateEnd: dateEnd,
          registrationDate: activity.registrationDate ? (() => {
            try {
              // Handle format like "May 21, 2025 9:00am"
              const dateStr = activity.registrationDate.replace(' at ', ' ').replace(/(\d{1,2}):(\d{2})([ap]m)/i, (match, h, m, ampm) => {
                let hour = parseInt(h);
                if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
                if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
                return ` ${hour}:${m}:00`;
              });
              const parsed = new Date(dateStr);
              return isNaN(parsed.getTime()) ? null : parsed;
            } catch {
              return null;
            }
          })() : null,
          ageMin: activity.ageRange?.min || null,
          ageMax: activity.ageRange?.max || null,
          cost: activity.cost || 0,
          spotsAvailable: activity.spotsAvailable || null,
          totalSpots: activity.totalSpots || null,
          locationName: activity.location || null,
          registrationUrl: activity.registrationUrl || null,
          courseId: activity.courseId || null,
          isActive: true,
          lastSeenAt: new Date(),
          rawData: activity
        };
        
        // Handle location
        if (activity.location) {
          const location = await prisma.location.upsert({
            where: {
              name_address: {
                name: activity.location,
                address: activity.facility || ''
              }
            },
            update: {},
            create: {
              name: activity.location,
              address: activity.facility || '',
              city: 'North Vancouver',
              province: 'BC',
              facility: activity.facility || null
            }
          });
          activityData.locationId = location.id;
        }
        
        // Upsert activity
        const { locationId, ...activityDataWithoutLocation } = activityData;
        await prisma.activity.upsert({
          where: {
            providerId_externalId: {
              providerId: provider.id,
              externalId: activityData.externalId
            }
          },
          update: {
            ...activityDataWithoutLocation,
            ...(locationId && { locationId })
          },
          create: {
            ...activityDataWithoutLocation,
            ...(locationId && { locationId })
          }
        });
        
        saved++;
        if (saved % 10 === 0) {
          console.log(`💾 Saved ${saved} activities...`);
        }
      } catch (error) {
        console.error(`❌ Error saving activity ${activity.name}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`   - Total scraped: ${activities.length}`);
    console.log(`   - Successfully saved: ${saved}`);
    console.log(`   - Date parsing errors: ${dateErrors}`);
    console.log(`   - Other errors: ${errors}`);
    
    // Mark stale activities as inactive
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 24);
    
    const updated = await prisma.activity.updateMany({
      where: {
        providerId: provider.id,
        lastSeenAt: {
          lt: staleDate
        }
      },
      data: {
        isActive: false
      }
    });
    
    console.log(`   - Marked ${updated.count} stale activities as inactive`);
    
  } catch (error) {
    console.error('❌ Scraper error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the scraper
runScraper().catch(console.error);