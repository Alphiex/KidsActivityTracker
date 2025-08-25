const axios = require('axios');

async function testAPI() {
  try {
    const response = await axios.get('http://localhost:3000/api/v1/activity-types');
    console.log('API Response:');
    const swimmingTypes = response.data.activityTypes.filter(t => 
      t.name.toLowerCase().includes('swim')
    );
    console.log('Swimming-related types:', swimmingTypes);
    
    console.log('\nAll types:');
    response.data.activityTypes.slice(0, 10).forEach(type => {
      console.log(`  ${type.name}: ${type.count}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
    console.log('Make sure the backend server is running on port 3000');
  }
}

testAPI();
