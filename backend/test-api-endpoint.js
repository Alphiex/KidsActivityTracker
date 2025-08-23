const axios = require('axios');

async function testAPI() {
  const baseURL = 'https://kids-activity-api-4ev6yi22va-uc.a.run.app';
  
  console.log('Testing API endpoints...\n');
  
  // Test health endpoint
  try {
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test stats endpoint
  try {
    const statsResponse = await axios.get(`${baseURL}/api/v1/activities/stats/summary`);
    console.log('\n✅ Stats endpoint works');
    console.log('Total activities:', statsResponse.data.stats?.totalActive);
  } catch (error) {
    console.log('\n❌ Stats endpoint failed:', error.response?.data || error.message);
  }
  
  // Test activities endpoint
  try {
    const activitiesResponse = await axios.get(`${baseURL}/api/v1/activities`, {
      params: { limit: 1 }
    });
    console.log('\n✅ Activities endpoint works');
    console.log('Success:', activitiesResponse.data.success);
  } catch (error) {
    console.log('\n❌ Activities endpoint failed:', error.response?.data || error.message);
  }
  
  // Test a simple activity query without includes
  try {
    const testResponse = await axios.get(`${baseURL}/api/v1/test-simple`);
    console.log('\n✅ Test endpoint works:', testResponse.data);
  } catch (error) {
    console.log('\n❌ Test endpoint not found (expected)');
  }
}

testAPI();