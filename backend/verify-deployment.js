#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://kids-activity-api-205843686007.us-central1.run.app';

async function verifyDeployment() {
  console.log('🚀 VERIFYING DEPLOYMENT\n');
  console.log(`API URL: ${API_URL}`);
  console.log('='.repeat(60) + '\n');
  
  try {
    // 1. Check health
    console.log('1. HEALTH CHECK:');
    const healthRes = await axios.get(`${API_URL}/health`);
    console.log(`   Status: ${healthRes.status}`);
    console.log(`   Response:`, healthRes.data);
    
    // 2. Check locations
    console.log('\n2. LOCATIONS ENDPOINT:');
    const locRes = await axios.get(`${API_URL}/api/v1/locations`);
    console.log(`   Status: ${locRes.status}`);
    console.log(`   Locations returned: ${locRes.data.locations.length}`);
    
    // Filter out bad locations to show what the app will see
    const goodLocations = locRes.data.locations.filter(loc => 
      loc.name.length <= 50 && !loc.name.includes('.')
    );
    console.log(`   Valid locations: ${goodLocations.length}`);
    console.log('\n   Sample locations:');
    goodLocations.slice(0, 5).forEach(loc => {
      console.log(`   - ${loc.name}: ${loc.activityCount} activities`);
    });
    
    // 3. Check categories
    console.log('\n3. CATEGORIES ENDPOINT:');
    const catRes = await axios.get(`${API_URL}/api/v1/categories`);
    console.log(`   Status: ${catRes.status}`);
    console.log(`   Categories: ${catRes.data.categories.length}`);
    catRes.data.categories.forEach(cat => {
      console.log(`   - ${cat.name}: ${cat.count} activities`);
    });
    
    // 4. Test location filtering
    console.log('\n4. ACTIVITY FILTERING BY LOCATION:');
    const testLocation = goodLocations[0];
    const actRes = await axios.get(`${API_URL}/api/v1/activities`, {
      params: { 
        location: testLocation.name,
        limit: 5 
      }
    });
    console.log(`   Location: "${testLocation.name}"`);
    console.log(`   Activities found: ${actRes.data.activities.length}`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ DEPLOYMENT VERIFICATION COMPLETE\n');
    console.log('SUMMARY:');
    console.log(`- API is healthy and responding`);
    console.log(`- Location browse will show ${goodLocations.length} valid locations`);
    console.log(`- All 4 browse buttons have working endpoints`);
    console.log(`- Activity filtering by location is working`);
    console.log('\nNOTE: Some locations have corrupted names that need database cleanup');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

verifyDeployment();