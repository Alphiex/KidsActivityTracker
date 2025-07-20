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
let cachedCamps = null;
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
    const camps = await nvrcInteractiveScraper.scrape();
    
    // Update cache
    cachedCamps = camps;
    cacheTimestamp = Date.now();
    
    res.json({
      success: true,
      camps: camps,
      scrapedAt: new Date(),
      totalFound: camps.length,
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
app.get('/api/scrape/nvrc', async (req, res) => {
  try {
    // Check cache first
    if (cachedCamps && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      console.log('Returning cached camps data');
      return res.json({
        success: true,
        camps: cachedCamps,
        scrapedAt: new Date(cacheTimestamp),
        totalFound: cachedCamps.length,
        cached: true
      });
    }

    console.log('🔍 Checking for cached data...');
    
    // If force refresh requested, clear cache
    if (req.query.refresh === 'true') {
      console.log('  Force refresh requested, clearing cache');
      cachedCamps = null;
      cacheTimestamp = null;
    }
    
    let camps = [];
    
    // First, try to get data from the camp data service
    try {
      camps = await campDataService.getCamps(req.query.refresh === 'true');
      
      // If we have good data, optionally try to update with fresh scraped data in background
      if (camps.length > 0 && req.query.scrape === 'true' && nvrcInteractiveScraper) {
        console.log('🔄 Running background scrape for fresh data...');
        nvrcInteractiveScraper.scrape()
          .then(scrapedCamps => {
            if (scrapedCamps.length > 0) {
              campDataService.saveScrapedData(scrapedCamps);
              console.log(`✅ Background scrape found ${scrapedCamps.length} programs`);
            }
          })
          .catch(err => {
            console.error('❌ Background scrape failed:', err.message);
          });
      }
    } catch (error) {
      console.error('❌ Error getting camp data:', error.message);
      
      // Try the interactive scraper as last resort
      if (nvrcInteractiveScraper) {
        console.log('🚀 Attempting live scrape...');
        try {
          camps = await nvrcInteractiveScraper.scrape();
          if (camps.length > 0) {
            await campDataService.saveScrapedData(camps);
          }
        } catch (scrapeError) {
          console.error('❌ Live scraping failed:', scrapeError.message);
          // Use generated sample data
          camps = await campDataService.getCamps(true);
        }
      }
    }
    
    // Update cache
    cachedCamps = camps;
    cacheTimestamp = Date.now();
    
    res.json({
      success: true,
      camps: camps,
      scrapedAt: new Date(),
      totalFound: camps.length,
      cached: cachedCamps === camps
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      camps: [],
      totalFound: 0
    });
  }
});

// Search endpoint
app.get('/api/camps/search', async (req, res) => {
  const { activityTypes, minAge, maxAge, maxCost } = req.query;
  
  // Use cached camps or fetch new ones
  let allCamps = cachedCamps || [];
  
  if (allCamps.length === 0) {
    // Try to fetch camps if none cached
    try {
      const response = await axios.get(`http://localhost:${PORT}/api/scrape/nvrc`);
      if (response.data.success) {
        allCamps = response.data.camps;
      }
    } catch (error) {
      console.error('Error fetching camps for search:', error);
    }
  }
  
  let filtered = [...allCamps];
  
  if (activityTypes) {
    const types = activityTypes.split(',');
    filtered = filtered.filter(camp => 
      camp.activityType.some(type => types.includes(type))
    );
  }
  
  if (minAge || maxAge) {
    filtered = filtered.filter(camp => {
      const min = parseInt(minAge) || 0;
      const max = parseInt(maxAge) || 100;
      return camp.ageRange.min >= min && camp.ageRange.max <= max;
    });
  }
  
  if (maxCost) {
    filtered = filtered.filter(camp => camp.cost <= parseInt(maxCost));
  }
  
  res.json({
    success: true,
    camps: filtered,
    totalFound: filtered.length
  });
});

// Camp details endpoint
app.get('/api/camps/:id', (req, res) => {
  const allCamps = cachedCamps || [];
  const camp = allCamps.find(c => c.id === req.params.id);
  
  if (camp) {
    res.json({ success: true, camp });
  } else {
    res.status(404).json({ success: false, error: 'Camp not found' });
  }
});

// Register endpoint (mock)
app.post('/api/register', (req, res) => {
  const { campId, childId, siteAccount } = req.body;
  
  // Mock registration response
  setTimeout(() => {
    res.json({
      success: true,
      confirmationNumber: `NVRC-${Date.now()}`,
      message: 'Registration initiated. Check your email for confirmation.'
    });
  }, 1000);
});

const server = app.listen(PORT, () => {
  console.log(`Kids Camp Tracker API running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('- GET /api/scrape/nvrc (main endpoint - uses interactive scraper)');
  console.log('- GET /api/scrape/nvrc-interactive (test interactive scraper directly)');
  console.log('- GET /api/camps/search?activityTypes=swimming,camps&maxCost=300');
  console.log('- GET /api/camps/:id');
  console.log('- POST /api/register');
  console.log('\n✅ Server is ready to receive requests!');
  console.log('📝 Note: First scrape may take 30-60 seconds to load all results');
});

module.exports = server;