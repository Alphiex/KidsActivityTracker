#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://kids-activity-api-44042034457.us-central1.run.app/api/v1';

async function testAPIEndpoints() {
  console.log('🔍 TESTING API ENDPOINTS\n');
  
  try {
    // 1. Test Locations
    console.log('1. LOCATIONS ENDPOINT:');
    console.log('-'.repeat(40));
    const locationsRes = await axios.get(`${API_URL}/locations`);
    console.log(`Status: ${locationsRes.status}`);
    console.log(`Success: ${locationsRes.data.success}`);
    console.log(`Locations returned: ${locationsRes.data.locations?.length || 0}`);
    if (locationsRes.data.locations?.length > 0) {
      console.log('First 3 locations:');
      locationsRes.data.locations.slice(0, 3).forEach(loc => {
        console.log(`  - ${loc.name} (${loc.activityCount || 0} activities)`);
      });
    }
    
    // 2. Test Categories
    console.log('\n2. CATEGORIES ENDPOINT:');
    console.log('-'.repeat(40));
    const categoriesRes = await axios.get(`${API_URL}/categories`);
    console.log(`Status: ${categoriesRes.status}`);
    console.log(`Success: ${categoriesRes.data.success}`);
    console.log(`Categories returned: ${categoriesRes.data.categories?.length || 0}`);
    if (categoriesRes.data.categories?.length > 0) {
      console.log('Categories:');
      categoriesRes.data.categories.forEach(cat => {
        const name = typeof cat === 'string' ? cat : cat.name;
        const count = typeof cat === 'object' ? cat.count : '?';
        console.log(`  - ${name} (${count} activities)`);
      });
    }
    
    // 3. Test Age Groups
    console.log('\n3. AGE GROUPS ENDPOINT:');
    console.log('-'.repeat(40));
    try {
      const ageGroupsRes = await axios.get(`${API_URL}/age-groups`);
      console.log(`Status: ${ageGroupsRes.status}`);
      console.log(`Success: ${ageGroupsRes.data.success}`);
      console.log(`Age groups returned: ${ageGroupsRes.data.ageGroups?.length || 0}`);
    } catch (error) {
      console.log(`Error: ${error.response?.status || error.message}`);
      console.log('(Endpoint may not be deployed yet)');
    }
    
    // 4. Test Activity Types
    console.log('\n4. ACTIVITY TYPES ENDPOINT:');
    console.log('-'.repeat(40));
    try {
      const typesRes = await axios.get(`${API_URL}/activity-types`);
      console.log(`Status: ${typesRes.status}`);
      console.log(`Success: ${typesRes.data.success}`);
      console.log(`Activity types returned: ${typesRes.data.activityTypes?.length || 0}`);
    } catch (error) {
      console.log(`Error: ${error.response?.status || error.message}`);
      console.log('(Endpoint may not be deployed yet)');
    }
    
  } catch (error) {
    console.error('Error testing endpoints:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAPIEndpoints();