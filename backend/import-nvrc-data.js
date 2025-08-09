const fs = require('fs');

// This script imports NVRC activity data to production database using the API

async function importData() {
  console.log('🚀 Starting NVRC data import to production...');
  
  const API_URL = process.env.PRODUCTION_API_URL || 'https://nvrc-scraper-993893782582.us-central1.run.app';
  const API_KEY = process.env.API_KEY || 'your-api-key-here';
  
  try {
    // Read the data file
    const filename = 'nvrc_working_hierarchical_2025-08-03T20-32-27-985Z.json';
    console.log(`📄 Reading data from ${filename}...`);
    
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const activities = data.activities || [];
    
    console.log(`📊 Found ${activities.length} activities to import`);
    
    if (activities.length === 0) {
      console.error('❌ No activities found in file!');
      return;
    }
    
    // Import activities in batches
    const batchSize = 100;
    let imported = 0;
    let errors = 0;
    
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activities.length/batchSize)}...`);
      
      try {
        const response = await fetch(`${API_URL}/api/activities/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            activities: batch.map(activity => ({
              externalId: activity.id || activity.courseId,
              organizationId: 'nvrc',
              name: activity.name || 'Unnamed Activity',
              category: activity.categoryName || activity.category || 'General',
              subcategory: activity.serviceName || null,
              description: [
                activity.name,
                activity.instructor ? `Instructor: ${activity.instructor}` : null,
                activity.dates,
                activity.times || activity.time,
                activity.location,
                activity.price,
                activity.spotsRemaining ? `${activity.spotsRemaining} spots remaining` : null
              ].filter(Boolean).join('\n'),
              location: activity.location || 'TBD',
              dates: activity.dates || 'Ongoing',
              times: activity.times || 'Various',
              price: activity.price || 'Contact for pricing',
              registrationRequired: true,
              registrationUrl: activity.registerUrl || 'https://www.nvrc.ca/programs-memberships/find-program',
              ageRange: activity.ageRange || 'All Ages',
              tags: [
                activity.categoryName,
                activity.serviceName,
                activity.location
              ].filter(Boolean),
              isActive: activity.spotsRemaining !== '0',
              rawData: activity
            }))
          })
        });
        
        if (response.ok) {
          imported += batch.length;
          console.log(`  ✅ Imported ${batch.length} activities`);
        } else {
          const error = await response.text();
          console.error(`  ❌ Failed to import batch: ${error}`);
          errors += batch.length;
        }
        
      } catch (error) {
        console.error(`  ❌ Error importing batch:`, error.message);
        errors += batch.length;
      }
    }
    
    console.log('\n📊 Import complete:');
    console.log(`  ✅ Successfully imported: ${imported}`);
    console.log(`  ❌ Failed to import: ${errors}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Check if we're running from command line
if (require.main === module) {
  // Check if API endpoint exists
  if (!process.env.PRODUCTION_API_URL) {
    console.log('\n⚠️  Note: PRODUCTION_API_URL not set. Using default Cloud Run URL.');
    console.log('If you have a different API endpoint, set PRODUCTION_API_URL environment variable.\n');
  }
  
  importData()
    .then(() => console.log('\n✅ Import process completed'))
    .catch(error => console.error('\n❌ Import failed:', error));
}