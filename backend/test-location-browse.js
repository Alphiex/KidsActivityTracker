#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://kids-activity-api-44042034457.us-central1.run.app/api/v1';

async function testLocationBrowse() {
  console.log('🔍 TESTING LOCATION BROWSE FUNCTIONALITY\n');
  
  try {
    // 1. Test Locations API
    console.log('1. FETCHING LOCATIONS:');
    console.log('-'.repeat(50));
    const locationsRes = await axios.get(`${API_URL}/locations`);
    console.log(`Status: ${locationsRes.status}`);
    console.log(`Success: ${locationsRes.data.success}`);
    console.log(`Total locations: ${locationsRes.data.locations?.length || 0}`);
    
    if (locationsRes.data.locations?.length > 0) {
      console.log('\nTop 5 locations by activity count:');
      locationsRes.data.locations.slice(0, 5).forEach((loc, idx) => {
        console.log(`  ${idx + 1}. ${loc.name}`);
        console.log(`     Activities: ${loc.activityCount}`);
        console.log(`     City: ${loc.city || 'N/A'}`);
      });
      
      // 2. Test fetching activities for a specific location
      const topLocation = locationsRes.data.locations[0];
      console.log(`\n2. FETCHING ACTIVITIES FOR "${topLocation.name}":`)
      console.log('-'.repeat(50));
      
      const activitiesRes = await axios.get(`${API_URL}/activities`, {
        params: {
          location: topLocation.name,
          limit: 10
        }
      });
      
      console.log(`Status: ${activitiesRes.status}`);
      console.log(`Activities found: ${activitiesRes.data.activities?.length || 0}`);
      
      if (activitiesRes.data.activities?.length > 0) {
        console.log('\nFirst 3 activities:');
        activitiesRes.data.activities.slice(0, 3).forEach((activity, idx) => {
          console.log(`  ${idx + 1}. ${activity.name}`);
          console.log(`     Category: ${activity.category}`);
          console.log(`     Cost: $${activity.cost || 0}`);
          console.log(`     Ages: ${activity.ageMin}-${activity.ageMax}`);
        });
      }
    }
    
    // 3. Verify no bad location data
    console.log('\n3. DATA QUALITY CHECK:');
    console.log('-'.repeat(50));
    const badLocations = locationsRes.data.locations?.filter(loc => {
      return loc.name.length > 100 || 
             loc.name.includes('\n') || 
             loc.name.match(/lesson|class|program|registration|#\d{6}/i);
    }) || [];
    
    if (badLocations.length > 0) {
      console.log(`⚠️  Found ${badLocations.length} locations with bad data`);
      badLocations.slice(0, 3).forEach(loc => {
        console.log(`   - "${loc.name.substring(0, 50)}..."`);
      });
    } else {
      console.log('✅ All location names look clean');
    }
    
  } catch (error) {
    console.error('Error testing location browse:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testLocationBrowse();