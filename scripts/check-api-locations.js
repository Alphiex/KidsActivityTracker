// Node 18+ has built-in fetch

async function checkAPILocations() {
  try {
    console.log('Checking API response for locations...\n');
    
    // Check the API endpoint
    const response = await fetch('http://localhost:3000/api/v1/activities');
    
    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('API returned error:', data.error);
      return;
    }
    
    const activities = data.activities || [];
    
    // Group by location
    const locationGroups = activities.reduce((acc, activity) => {
      let locationName = 'Unknown Location';
      
      // Check various location fields
      if (activity.location) {
        if (typeof activity.location === 'string') {
          locationName = activity.location;
        } else if (typeof activity.location === 'object' && activity.location.name) {
          locationName = activity.location.name;
        }
      } else if (activity.locationName) {
        locationName = activity.locationName;
      } else if (activity.facility) {
        locationName = activity.facility;
      }
      
      if (!acc[locationName]) {
        acc[locationName] = 0;
      }
      acc[locationName]++;
      return acc;
    }, {});
    
    // Convert to sorted array
    const sortedLocations = Object.entries(locationGroups)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    console.log(`Total activities from API: ${activities.length}`);
    console.log(`Total unique locations: ${sortedLocations.length}\n`);
    
    console.log('=== TOP 20 LOCATIONS FROM API ===\n');
    sortedLocations.slice(0, 20).forEach((loc, index) => {
      console.log(`${index + 1}. ${loc.name}: ${loc.count} activities`);
    });
    
    // Check the structure of first few activities
    console.log('\n=== SAMPLE ACTIVITY LOCATION DATA ===\n');
    activities.slice(0, 3).forEach((activity, index) => {
      console.log(`Activity ${index + 1}: ${activity.name}`);
      console.log(`  location field: ${JSON.stringify(activity.location)}`);
      console.log(`  locationName field: ${activity.locationName}`);
      console.log(`  facility field: ${activity.facility}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error checking API locations:', error);
  }
}

checkAPILocations();