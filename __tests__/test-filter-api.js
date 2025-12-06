const axios = require('axios');

// Test the API directly to see if filtering works
async function testFilterAPI() {
  const baseURL = 'https://kids-activity-api-205843686007.us-central1.run.app';

  console.log('Testing API filtering...\n');

  // Test 1: Get activities WITHOUT filter
  console.log('1. Getting activities WITHOUT filter:');
  try {
    const response1 = await axios.get(`${baseURL}/api/v1/activities`, {
      params: {
        categories: 'Swimming & Aquatics',
        activitySubtype: 'Other Aquatics',
        limit: 5
      }
    });
    console.log(`   Total activities: ${response1.data.pagination.total}`);
    console.log('   First 3 activities:');
    response1.data.activities.slice(0, 3).forEach((activity, i) => {
      console.log(`   ${i+1}. ${activity.name}`);
      console.log(`      - Spots available: ${activity.spotsAvailable}`);
      console.log(`      - Registration status: ${activity.registrationStatus}`);
      console.log(`      - Is FULL: ${activity.spotsAvailable === 0 ? 'YES ❌' : 'NO ✅'}`);
    });
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n2. Getting activities WITH exclude_full filter:');
  try {
    const response2 = await axios.get(`${baseURL}/api/v1/activities`, {
      params: {
        categories: 'Swimming & Aquatics',
        activitySubtype: 'Other Aquatics',
        exclude_full: 'true',
        limit: 5
      }
    });
    console.log(`   Total activities: ${response2.data.pagination.total}`);
    console.log('   First 3 activities:');
    response2.data.activities.slice(0, 3).forEach((activity, i) => {
      console.log(`   ${i+1}. ${activity.name}`);
      console.log(`      - Spots available: ${activity.spotsAvailable}`);
      console.log(`      - Registration status: ${activity.registrationStatus}`);
      console.log(`      - Is FULL: ${activity.spotsAvailable === 0 ? 'YES ❌' : 'NO ✅'}`);
    });
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n3. Getting activities WITH hideFullActivities filter:');
  try {
    const response3 = await axios.get(`${baseURL}/api/v1/activities`, {
      params: {
        categories: 'Swimming & Aquatics',
        activitySubtype: 'Other Aquatics',
        hideFullActivities: 'true',
        limit: 5
      }
    });
    console.log(`   Total activities: ${response3.data.pagination.total}`);
    console.log('   First 3 activities:');
    response3.data.activities.slice(0, 3).forEach((activity, i) => {
      console.log(`   ${i+1}. ${activity.name}`);
      console.log(`      - Spots available: ${activity.spotsAvailable}`);
      console.log(`      - Registration status: ${activity.registrationStatus}`);
      console.log(`      - Is FULL: ${activity.spotsAvailable === 0 ? 'YES ❌' : 'NO ✅'}`);
    });
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n4. Getting activities WITH hide_full_activities filter:');
  try {
    const response4 = await axios.get(`${baseURL}/api/v1/activities`, {
      params: {
        categories: 'Swimming & Aquatics',
        activitySubtype: 'Other Aquatics',
        hide_full_activities: 'true',
        limit: 5
      }
    });
    console.log(`   Total activities: ${response4.data.pagination.total}`);
    console.log('   First 3 activities:');
    response4.data.activities.slice(0, 3).forEach((activity, i) => {
      console.log(`   ${i+1}. ${activity.name}`);
      console.log(`      - Spots available: ${activity.spotsAvailable}`);
      console.log(`      - Registration status: ${activity.registrationStatus}`);
      console.log(`      - Is FULL: ${activity.spotsAvailable === 0 ? 'YES ❌' : 'NO ✅'}`);
    });
  } catch (error) {
    console.error('   Error:', error.message);
  }
}

testFilterAPI();