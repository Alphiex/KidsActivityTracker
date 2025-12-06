#!/usr/bin/env node

const axios = require('axios');

async function testAuth() {
  const urls = [
    'https://kids-activity-api-4ev6yi22va-uc.a.run.app',  // Old URL in app
    'https://kids-activity-api-205843686007.us-central1.run.app'  // Correct URL
  ];

  const testAccounts = [
    { email: 'test@kidsactivity.com', password: 'Test123!' },
    { email: 'demo@kidsactivity.com', password: 'Demo123!' },
    { email: 'parent@kidsactivity.com', password: 'Parent123!' }
  ];

  for (const baseUrl of urls) {
    console.log(`\n========== Testing API: ${baseUrl} ==========`);

    for (const account of testAccounts) {
      console.log(`\nTesting: ${account.email}`);

      try {
        const response = await axios.post(`${baseUrl}/api/auth/login`, account, {
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const data = response.data;

        if (response.status === 200 && data.success) {
          console.log(`✅ SUCCESS: ${account.email} authenticated`);
          console.log(`   Token: ${data.token ? data.token.substring(0, 20) + '...' : 'N/A'}`);
        } else {
          console.log(`❌ FAILED: ${account.email}`);
          console.log(`   Error: ${data.error || data.message || 'Unknown error'}`);
        }
      } catch (error) {
        if (error.response) {
          console.log(`❌ FAILED: ${account.email}`);
          console.log(`   Status: ${error.response.status}`);
          console.log(`   Error: ${error.response.data?.error || error.response.data?.message || 'Unknown error'}`);
        } else {
          console.log(`❌ ERROR: ${account.email}`);
          console.log(`   ${error.message}`);
        }
      }
    }
  }
}

testAuth().catch(console.error);