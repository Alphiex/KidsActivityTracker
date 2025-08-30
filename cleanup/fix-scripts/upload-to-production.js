const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load the scrape data
const scrapeFile = path.join(__dirname, 'backend', 'nvrc_working_hierarchical_2025-08-03T20-32-27-985Z.json');
const scrapeData = JSON.parse(fs.readFileSync(scrapeFile, 'utf8'));

const API_URL = 'https://kids-activity-api-205843686007.us-central1.run.app';

async function uploadActivities() {
  console.log(`📤 Uploading ${scrapeData.activities.length} activities to production...`);
  
  const activities = scrapeData.activities;
  let uploaded = 0;
  let errors = 0;
  
  // Process in batches of 10
  for (let i = 0; i < activities.length; i += 10) {
    const batch = activities.slice(i, i + 10);
    
    await Promise.all(batch.map(async (activity) => {
      try {
        // Prepare activity for API
        const activityData = {
          name: activity.name,
          category: activity.category || 'Uncategorized',
          subcategory: activity.subcategory,
          description: activity.description,
          dates: activity.dates,
          schedule: activity.schedule,
          ageMin: activity.ageRange?.min || 0,
          ageMax: activity.ageRange?.max || 18,
          location: activity.location,
          cost: activity.cost || 0,
          spotsAvailable: activity.spotsAvailable,
          registrationUrl: activity.registrationUrl,
          registrationDate: activity.registrationDate,
          courseId: activity.courseId,
          dateRange: activity.dateRange,
          provider: 'NVRC'
        };
        
        // POST to production API
        const response = await axios.post(`${API_URL}/api/v1/activities/import`, activityData, {
          headers: {
            'Content-Type': 'application/json',
            'X-Import-Key': 'nvrc-bulk-import-2025'
          },
          timeout: 30000
        });
        
        uploaded++;
        if (uploaded % 100 === 0) {
          console.log(`✅ Uploaded ${uploaded} activities...`);
        }
      } catch (error) {
        errors++;
        if (errors <= 10) {
          console.error(`❌ Error uploading ${activity.name}:`, error.message);
        }
      }
    }));
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   - Total activities: ${activities.length}`);
  console.log(`   - Successfully uploaded: ${uploaded}`);
  console.log(`   - Errors: ${errors}`);
  
  // Verify by checking stats
  try {
    const stats = await axios.get(`${API_URL}/api/v1/activities/stats/summary`);
    console.log(`\n✅ Production database now has ${stats.data.stats.totalActive} active activities`);
  } catch (error) {
    console.error('Could not fetch stats:', error.message);
  }
}

uploadActivities().catch(console.error);