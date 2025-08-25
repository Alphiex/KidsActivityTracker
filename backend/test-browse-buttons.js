#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://kids-activity-api-205843686007.us-central1.run.app/api/v1';

async function testBrowseButtons() {
  console.log('🔍 TESTING ALL BROWSE BUTTONS\n');
  
  const tests = [
    {
      name: 'Browse by Location',
      endpoint: '/locations',
      expectedFields: ['id', 'name', 'activityCount'],
      minCount: 10
    },
    {
      name: 'Browse by Category',
      endpoint: '/categories',
      expectedFields: ['name', 'count'],
      minCount: 5
    },
    {
      name: 'Browse by Age',
      endpoint: '/age-groups',
      expectedFields: ['id', 'name', 'min', 'max', 'count'],
      minCount: 5
    },
    {
      name: 'Browse by Type',
      endpoint: '/activity-types',
      expectedFields: ['name', 'count'],
      minCount: 5
    }
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    console.log(`\n${test.name}:`);
    console.log('-'.repeat(50));
    
    try {
      const response = await axios.get(`${API_URL}${test.endpoint}`);
      const data = response.data;
      
      // Check success flag
      if (!data.success) {
        console.log(`❌ FAILED: success flag is false`);
        console.log(`   Response: ${JSON.stringify(data)}`);
        continue;
      }
      
      // Get the data array (different key names for different endpoints)
      const dataKey = Object.keys(data).find(key => 
        Array.isArray(data[key]) && key !== 'success'
      );
      
      if (!dataKey) {
        console.log(`❌ FAILED: No data array found`);
        console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
        continue;
      }
      
      const items = data[dataKey];
      console.log(`✅ Success: true`);
      console.log(`✅ Data key: ${dataKey}`);
      console.log(`✅ Items returned: ${items.length}`);
      
      // Check minimum count
      if (items.length < test.minCount) {
        console.log(`⚠️  WARNING: Expected at least ${test.minCount} items, got ${items.length}`);
      }
      
      // Check fields on first item
      if (items.length > 0) {
        const firstItem = items[0];
        const missingFields = test.expectedFields.filter(field => 
          !(field in firstItem)
        );
        
        if (missingFields.length > 0) {
          console.log(`⚠️  WARNING: Missing fields: ${missingFields.join(', ')}`);
          console.log(`   Item fields: ${Object.keys(firstItem).join(', ')}`);
        } else {
          console.log(`✅ All expected fields present`);
        }
        
        // Show first 3 items
        console.log('\nFirst 3 items:');
        items.slice(0, 3).forEach((item, idx) => {
          const name = item.name || item.category || item.subcategory || 'Unknown';
          const count = item.count || item.activityCount || item._count || '?';
          console.log(`  ${idx + 1}. ${name} (${count} activities)`);
        });
      }
      
      passedTests++;
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`SUMMARY: ${passedTests}/${tests.length} tests passed`);
  
  if (passedTests < tests.length) {
    console.log('\n⚠️  Some endpoints are failing. This could be because:');
    console.log('1. The API changes haven\'t been deployed yet');
    console.log('2. The endpoints are returning errors');
    console.log('\nTo deploy: git push to main branch to trigger GitHub Actions');
  } else {
    console.log('\n✅ All browse button endpoints are working correctly!');
  }
}

// Test activities endpoint with location filter
async function testLocationFilter() {
  console.log('\n\nTESTING LOCATION FILTER:');
  console.log('='.repeat(50));
  
  try {
    // First get a location
    const locRes = await axios.get(`${API_URL}/locations`);
    if (locRes.data.success && locRes.data.locations?.length > 0) {
      const location = locRes.data.locations[0];
      console.log(`\nTesting filter for location: "${location.name}"`);
      
      // Get activities for that location
      const actRes = await axios.get(`${API_URL}/activities`, {
        params: { location: location.name, limit: 5 }
      });
      
      if (actRes.data.success) {
        console.log(`✅ Found ${actRes.data.activities.length} activities`);
        if (actRes.data.activities.length > 0) {
          console.log('\nFirst activity:');
          const act = actRes.data.activities[0];
          console.log(`  Name: ${act.name}`);
          console.log(`  Location: ${act.location}`);
          console.log(`  Category: ${act.category}`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Location filter test failed: ${error.message}`);
  }
}

// Run tests
testBrowseButtons().then(() => testLocationFilter());