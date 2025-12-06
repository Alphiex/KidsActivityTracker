#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'https://kids-activity-api-4ev6yi22va-uc.a.run.app';

console.log('🔍 Testing API with comprehensive logging...\n');
console.log('=' .repeat(80));

async function testScenario(name, params, expectedDescription) {
  console.log(`\n📋 TEST: ${name}`);
  console.log('   Params:', JSON.stringify(params, null, 2));
  console.log('   Expected:', expectedDescription);
  console.log('-'.repeat(60));

  try {
    const url = `${API_URL}/api/v1/activities`;
    console.log('   🚀 Making request to:', url);

    const response = await axios.get(url, { params });

    console.log('   ✅ Response status:', response.status);
    console.log('   ✅ Success flag:', response.data.success);
    console.log('   ✅ Activities returned:', response.data.activities?.length || 0);
    console.log('   ✅ Total in database:', response.data.pagination?.total || 0);

    if (response.data.activities && response.data.activities.length > 0) {
      const first = response.data.activities[0];
      console.log('   📌 Sample activity:', {
        name: first.name.substring(0, 50) + '...',
        status: first.registrationStatus,
        spots: first.spotsAvailable,
        cost: first.cost
      });
    }

    return {
      success: true,
      total: response.data.pagination?.total || 0,
      count: response.data.activities?.length || 0
    };
  } catch (error) {
    console.log('   ❌ FAILED:', error.message);
    if (error.response) {
      console.log('   ❌ Status:', error.response.status);
      console.log('   ❌ Data:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.message
    };
  }
}

async function runAllTests() {
  const results = [];

  console.log('\n' + '=' .repeat(80));
  console.log('CRITICAL TESTS - MUST ALL PASS');
  console.log('=' .repeat(80));

  // Test 1: No parameters at all (should return ALL)
  results.push(await testScenario(
    '1. No parameters at all',
    { limit: 5 },
    'Should return ALL 1576 activities (limited to 5)'
  ));

  // Test 2: Explicitly set hideClosedOrFull=false
  results.push(await testScenario(
    '2. hideClosedOrFull=false (explicitly false)',
    { limit: 5, hideClosedOrFull: false },
    'Should return ALL 1576 activities (THIS IS THE CRITICAL TEST!)'
  ));

  // Test 3: hideClosedOrFull=true
  results.push(await testScenario(
    '3. hideClosedOrFull=true',
    { limit: 5, hideClosedOrFull: true },
    'Should return ~668 activities (open with spots)'
  ));

  // Test 4: String "false" vs boolean false
  results.push(await testScenario(
    '4. hideClosedOrFull="false" (string)',
    { limit: 5, hideClosedOrFull: "false" },
    'Should return ALL 1576 activities (string false = false)'
  ));

  // Test 5: String "true" vs boolean true
  results.push(await testScenario(
    '5. hideClosedOrFull="true" (string)',
    { limit: 5, hideClosedOrFull: "true" },
    'Should return ~668 activities (string true = true)'
  ));

  console.log('\n' + '=' .repeat(80));
  console.log('🎯 SUMMARY OF RESULTS');
  console.log('=' .repeat(80));

  let allPassed = true;
  results.forEach((result, index) => {
    const testNum = index + 1;
    if (result.success) {
      console.log(`Test ${testNum}: ✅ SUCCESS - Total: ${result.total}, Returned: ${result.count}`);
    } else {
      console.log(`Test ${testNum}: ❌ FAILED - ${result.error}`);
      allPassed = false;
    }
  });

  console.log('\n' + '=' .repeat(80));
  console.log('📊 CRITICAL FINDINGS:');
  console.log('=' .repeat(80));

  if (results[0].success && results[1].success) {
    const withoutParam = results[0].total;
    const withFalseParam = results[1].total;

    console.log(`• Without any params: ${withoutParam} activities`);
    console.log(`• With hideClosedOrFull=false: ${withFalseParam} activities`);

    if (withoutParam === withFalseParam && withFalseParam === 1576) {
      console.log('✅✅✅ CRITICAL TEST PASSED: hideClosedOrFull=false returns ALL activities!');
    } else {
      console.log('❌❌❌ CRITICAL TEST FAILED: hideClosedOrFull=false NOT working correctly!');
      console.log(`   Expected 1576, but got ${withFalseParam}`);
    }
  }

  if (results[2].success) {
    console.log(`• With hideClosedOrFull=true: ${results[2].total} activities`);
    if (results[0].success) {
      const filtered = results[0].total - results[2].total;
      console.log(`• Activities filtered out when hideClosedOrFull=true: ${filtered}`);
    }
  }

  console.log('\n' + '=' .repeat(80));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the results above.');
  }
  console.log('=' .repeat(80));
}

runAllTests().catch(console.error);