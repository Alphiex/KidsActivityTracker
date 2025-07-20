// Camp Data Service - Provides camp data from various sources
const fs = require('fs');
const path = require('path');

class CampDataService {
  constructor() {
    this.cachedData = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  }

  // Load pre-scraped data from JSON file
  async loadFromFile() {
    try {
      const dataPath = path.join(__dirname, '../data/nvrc-camps.json');
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log(`📁 Loaded ${data.length} camps from file`);
        return data;
      }
    } catch (error) {
      console.error('Error loading from file:', error);
    }
    return null;
  }

  // Generate realistic sample data based on NVRC's typical offerings
  generateSampleData() {
    const locations = [
      'North Vancouver Recreation Centre',
      'Harry Jerome Recreation Centre',
      'Lynn Valley Recreation Centre',
      'Parkgate Community Centre',
      'Karen Magnussen Recreation Centre',
      'Ron Andrews Recreation Centre'
    ];

    const activities = [
      { name: 'Summer Adventure Camp', type: 'camps', ageMin: 6, ageMax: 12 },
      { name: 'Little Swimmers', type: 'swimming', ageMin: 3, ageMax: 6 },
      { name: 'Aqua Kids Level 1', type: 'swimming', ageMin: 5, ageMax: 10 },
      { name: 'Bronze Cross', type: 'swimming', ageMin: 13, ageMax: 18 },
      { name: 'Kids Karate', type: 'martial_arts', ageMin: 6, ageMax: 12 },
      { name: 'Creative Arts Studio', type: 'visual_arts', ageMin: 4, ageMax: 8 },
      { name: 'Youth Dance Academy', type: 'dance', ageMin: 10, ageMax: 16 },
      { name: 'Music Makers', type: 'music', ageMin: 5, ageMax: 10 },
      { name: 'Science Explorers Camp', type: 'camps', ageMin: 8, ageMax: 14 },
      { name: 'Preschool Play', type: 'general', ageMin: 3, ageMax: 5 },
      { name: 'Teen Leadership Camp', type: 'camps', ageMin: 13, ageMax: 17 },
      { name: 'Little Athletes', type: 'sports', ageMin: 4, ageMax: 7 }
    ];

    const camps = [];
    let courseId = 10000;

    // Generate multiple sessions for each activity
    activities.forEach(activity => {
      // Create 2-4 sessions per activity
      const numSessions = Math.floor(Math.random() * 3) + 2;
      
      for (let i = 0; i < numSessions; i++) {
        const location = locations[Math.floor(Math.random() * locations.length)];
        const startDate = new Date(2024, 6 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 28) + 1);
        const duration = activity.type === 'camps' ? 5 : Math.floor(Math.random() * 8) + 4; // weeks
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (duration * 7));
        
        const days = activity.type === 'camps' 
          ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
          : i % 2 === 0 
            ? ['Monday', 'Wednesday', 'Friday']
            : ['Tuesday', 'Thursday'];
        
        const startHour = 9 + Math.floor(Math.random() * 8);
        const duration_hours = activity.type === 'camps' ? 7 : Math.floor(Math.random() * 2) + 1;
        
        const camp = {
          id: `nvrc-course-${courseId++}`,
          name: activity.name,
          provider: 'NVRC',
          description: `Join us for ${activity.name} at ${location}. A great program for kids aged ${activity.ageMin}-${activity.ageMax}.`,
          location: {
            name: location,
            address: `${Math.floor(Math.random() * 9000) + 1000} ${['Main', 'Marine', 'Lonsdale', 'Mountain', 'Lynn Valley'][Math.floor(Math.random() * 5)]} Rd, North Vancouver, BC`
          },
          cost: Math.floor(Math.random() * 200) + 100,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          },
          schedule: {
            days: days,
            startTime: `${startHour}:${['00', '30'][Math.floor(Math.random() * 2)]}`,
            endTime: `${startHour + duration_hours}:${['00', '30'][Math.floor(Math.random() * 2)]}`
          },
          ageRange: {
            min: activity.ageMin,
            max: activity.ageMax
          },
          spotsAvailable: Math.floor(Math.random() * 15) + 1,
          totalSpots: 20,
          registrationUrl: `https://www.nvrc.ca/register/course/${courseId}`,
          activityType: [activity.type],
          imageUrl: activity.type, // Frontend will map this to local images
          scrapedAt: new Date().toISOString()
        };
        
        camps.push(camp);
      }
    });

    console.log(`🎲 Generated ${camps.length} sample camps`);
    return camps;
  }

  // Get camps from the best available source
  async getCamps(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.cachedData && this.cacheTimestamp && 
        (Date.now() - this.cacheTimestamp < this.CACHE_DURATION)) {
      console.log('📦 Using cached camp data');
      return this.cachedData;
    }

    // Try to load from file first
    let camps = await this.loadFromFile();
    
    // If no file data, generate sample data
    if (!camps || camps.length === 0) {
      camps = this.generateSampleData();
    }

    // Update cache
    this.cachedData = camps;
    this.cacheTimestamp = Date.now();

    return camps;
  }

  // Save scraped data for future use
  async saveScrapedData(camps) {
    try {
      const dataDir = path.join(__dirname, '../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const dataPath = path.join(dataDir, 'nvrc-camps.json');
      fs.writeFileSync(dataPath, JSON.stringify(camps, null, 2));
      console.log(`💾 Saved ${camps.length} camps to file`);
      
      // Update cache
      this.cachedData = camps;
      this.cacheTimestamp = Date.now();
    } catch (error) {
      console.error('Error saving scraped data:', error);
    }
  }
}

module.exports = CampDataService;