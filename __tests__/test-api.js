#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://kids-activity-api-4ev6yi22va-uc.a.run.app';

async function testAPI() {
  console.log('🔍 Testing API connectivity and responses...\n');

  try {
    // Test 1: Basic API call without any filters
    console.log('Test 1: Basic API call without filters');
    const response1 = await axios.get(`${API_URL}/api/v1/activities?limit=5`);
    console.log('✅ Response status:', response1.status);
    console.log('✅ Success:', response1.data.success);
    console.log('✅ Activities returned:', response1.data.activities?.length);
    console.log('✅ Total available:', response1.data.pagination?.total);
    console.log('');

    // Test 2: API call with hideClosedActivities filter
    console.log('Test 2: API call with hideClosedActivities=true');
    const response2 = await axios.get(`${API_URL}/api/v1/activities?limit=5&hideClosedActivities=true`);
    console.log('✅ Activities returned:', response2.data.activities?.length);
    console.log('✅ Total available:', response2.data.pagination?.total);
    console.log('');

    // Test 3: API call with both hide filters
    console.log('Test 3: API call with hideClosedActivities=true&hideFullActivities=true');
    const response3 = await axios.get(`${API_URL}/api/v1/activities?limit=5&hideClosedActivities=true&hideFullActivities=true`);
    console.log('✅ Activities returned:', response3.data.activities?.length);
    console.log('✅ Total available:', response3.data.pagination?.total);
    console.log('');

    // Test 4: API call with invalid hideClosedOrFull parameter
    console.log('Test 4: API call with hideClosedOrFull=true (invalid parameter)');
    const response4 = await axios.get(`${API_URL}/api/v1/activities?limit=5&hideClosedOrFull=true`);
    console.log('⚠️  Activities returned:', response4.data.activities?.length);
    console.log('⚠️  Total available:', response4.data.pagination?.total);
    console.log('⚠️  Note: API ignores unknown parameters, returns all activities');
    console.log('');

    // Show a sample activity
    if (response1.data.activities?.length > 0) {
      const activity = response1.data.activities[0];
      console.log('Sample activity:');
      console.log('  Name:', activity.name);
      console.log('  Category:', activity.category);
      console.log('  Cost:', activity.cost);
      console.log('  Spots Available:', activity.spotsAvailable);
      console.log('  Registration Status:', activity.registrationStatus);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();