const axios = require('axios');

async function testEnhancedData() {
  try {
    console.log('Fetching activities from API...');
    const response = await axios.get('http://localhost:3000/api/v1/activities', {
      params: { limit: 5 }
    });
    
    if (response.data.success && response.data.activities) {
      console.log(`Found ${response.data.activities.length} activities`);
      
      response.data.activities.forEach((activity, index) => {
        console.log(`\n--- Activity ${index + 1}: ${activity.name} ---`);
        console.log('Has enhanced fields:');
        console.log('  - fullDescription:', !!activity.fullDescription);
        console.log('  - directRegistrationUrl:', !!activity.directRegistrationUrl);
        console.log('  - instructor:', !!activity.instructor);
        console.log('  - schedule:', !!activity.schedule);
        console.log('  - prerequisites:', !!activity.prerequisites);
        console.log('  - whatToBring:', !!activity.whatToBring);
        console.log('  - registrationStatus:', activity.registrationStatus);
        
        if (activity.directRegistrationUrl) {
          console.log('  Registration URL:', activity.directRegistrationUrl);
        }
      });
    } else {
      console.log('No activities found');
    }
  } catch (error) {
    console.error('Error fetching activities:', error.message);
  }
}

testEnhancedData();