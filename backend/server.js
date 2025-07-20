const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NVRCScraper = require('./scrapers/nvrcScraper');
const CampDataService = require('./services/campDataService');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize services
const nvrcScraper = new NVRCScraper();
const campDataService = new CampDataService();

// Load the interactive scraper
let nvrcInteractiveScraper = null;

try {
  const NVRCInteractiveScraper = require('./scrapers/nvrcInteractiveScraper');
  nvrcInteractiveScraper = new NVRCInteractiveScraper();
  console.log('✅ NVRC Interactive scraper loaded successfully');
} catch (error) {
  console.error('❌ NVRC Interactive scraper not available:', error.message);
}

// Cache to avoid excessive scraping
let cachedActivities = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Remove mock data - we'll use real scraped data only

// Test endpoint for interactive scraper
app.get('/api/scrape/nvrc-interactive', async (req, res) => {
  if (!nvrcInteractiveScraper) {
    return res.status(500).json({
      success: false,
      error: 'NVRC Interactive scraper not available'
    });
  }

  try {
    console.log('🚀 Running NVRC Interactive scraper...');
    const activities = await nvrcInteractiveScraper.scrape();
    
    // Update cache
    cachedActivities = activities;
    cacheTimestamp = Date.now();
    
    res.json({
      success: true,
      activities: activities,
      scrapedAt: new Date(),
      totalFound: activities.length,
      method: 'interactive'
    });
  } catch (error) {
    console.error('❌ NVRC Interactive scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Scrape NVRC endpoint
app.post('/api/scrape/nvrc', async (req, res) => {
  try {
    // Check cache first
    if (cachedActivities && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      console.log('Returning cached activities data');
      return res.json({
        success: true,
        activities: cachedActivities,
        scrapedAt: new Date(cacheTimestamp),
        totalFound: cachedActivities.length,
        cached: true
      });
    }

    console.log('🔍 Checking for cached data...');
    
    // If force refresh requested, clear cache
    if (req.body.refresh === true) {
      console.log('  Force refresh requested, clearing cache');
      cachedActivities = null;
      cacheTimestamp = null;
    }
    
    let activities = [];
    
    // First, try to get data from the camp data service
    try {
      activities = await campDataService.getCamps(req.body.refresh === true);
      
      // If we have good data, optionally try to update with fresh scraped data in background
      if (activities.length > 0 && req.body.scrape === true && nvrcInteractiveScraper) {
        console.log('🔄 Running background scrape for fresh data...');
        nvrcInteractiveScraper.scrape()
          .then(scrapedActivities => {
            if (scrapedActivities.length > 0) {
              campDataService.saveScrapedData(scrapedActivities);
              console.log(`✅ Background scrape found ${scrapedActivities.length} activities`);
            }
          })
          .catch(err => {
            console.error('❌ Background scrape failed:', err.message);
          });
      }
    } catch (error) {
      console.error('❌ Error getting activities data:', error.message);
      
      // Try the interactive scraper as last resort
      if (nvrcInteractiveScraper) {
        console.log('🚀 Attempting live scrape...');
        try {
          activities = await nvrcInteractiveScraper.scrape();
          if (activities.length > 0) {
            await campDataService.saveScrapedData(activities);
          }
        } catch (scrapeError) {
          console.error('❌ Live scraping failed:', scrapeError.message);
          // Use generated sample data
          activities = await campDataService.getCamps(true);
        }
      }
    }
    
    // Update cache
    cachedActivities = activities;
    cacheTimestamp = Date.now();
    
    res.json({
      success: true,
      activities: activities,
      scrapedAt: new Date(),
      totalFound: activities.length,
      cached: cachedActivities === activities
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      activities: [],
      totalFound: 0
    });
  }
});

// Search activities with filters
app.post('/api/activities/search', async (req, res) => {
  const { activityTypes, minAge, maxAge, maxCost } = req.body;
  
  // Use cached activities or fetch new ones
  let allActivities = cachedActivities || [];
  
  if (allActivities.length === 0) {
    // Try to fetch activities if none cached
    try {
      const response = await axios.post(`http://localhost:${PORT}/api/scrape/nvrc`);
      if (response.data.success) {
        allActivities = response.data.activities;
      }
    } catch (error) {
      console.error('Error fetching activities for search:', error);
    }
  }
  
  let filtered = [...allActivities];
  
  if (activityTypes && activityTypes.length > 0) {
    filtered = filtered.filter(activity => 
      activity.activityType.some(type => activityTypes.includes(type))
    );
  }
  
  if (minAge !== undefined || maxAge !== undefined) {
    filtered = filtered.filter(activity => {
      const min = minAge || 0;
      const max = maxAge || 100;
      return activity.ageRange.min >= min && activity.ageRange.max <= max;
    });
  }
  
  if (maxCost !== undefined) {
    filtered = filtered.filter(activity => activity.cost <= maxCost);
  }
  
  res.json({
    success: true,
    activities: filtered,
    totalFound: filtered.length
  });
});

// Get single activity details
app.get('/api/activities/:id', (req, res) => {
  const allActivities = cachedActivities || [];
  const activity = allActivities.find(a => a.id === req.params.id);
  
  if (activity) {
    res.json({ success: true, activity });
  } else {
    res.status(404).json({ success: false, error: 'Activity not found' });
  }
});

// Register endpoint (mock)
app.post('/api/register', (req, res) => {
  const { activityId, childId, siteAccount } = req.body;
  
  // Mock registration response
  setTimeout(() => {
    res.json({
      success: true,
      confirmationNumber: `NVRC-${Date.now()}`,
      message: 'Registration initiated. Check your email for confirmation.'
    });
  }, 1000);
});

// Refresh endpoint
app.post('/api/refresh', async (req, res) => {
  try {
    console.log('🔄 Refreshing activities data...');
    
    // Clear cache
    cachedActivities = null;
    cacheTimestamp = null;
    
    // Fetch fresh data
    let activities = [];
    
    if (nvrcInteractiveScraper) {
      console.log('🚀 Running interactive scraper...');
      try {
        activities = await nvrcInteractiveScraper.scrape();
        if (activities.length > 0) {
          await campDataService.saveScrapedData(activities);
          cachedActivities = activities;
          cacheTimestamp = Date.now();
        }
      } catch (scrapeError) {
        console.error('❌ Interactive scraping failed:', scrapeError.message);
      }
    }
    
    if (activities.length === 0) {
      // Fallback to saved data
      activities = await campDataService.getCamps(true);
      cachedActivities = activities;
      cacheTimestamp = Date.now();
    }
    
    res.json({
      success: true,
      activities: activities,
      totalFound: activities.length,
      refreshedAt: new Date()
    });
  } catch (error) {
    console.error('❌ Refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Kids Activity Tracker API running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('- POST /api/scrape/nvrc (main endpoint - uses interactive scraper)');
  console.log('- GET /api/scrape/nvrc-interactive (test interactive scraper directly)');
  console.log('- POST /api/activities/search');
  console.log('- GET /api/activities/:id');
  console.log('- POST /api/register');
  console.log('- POST /api/refresh');
  console.log('\n✅ Server is ready to receive requests!');
  console.log('📝 Note: First scrape may take 30-60 seconds to load all results');
});

module.exports = server;