#!/usr/bin/env node

const axios = require('axios');

async function registerTestUser() {
  const apiUrl = 'https://kids-activity-api-205843686007.us-central1.run.app';

  const testUser = {
    email: 'test@kidsactivity.com',
    password: 'Test123!',
    name: 'Test User'
  };

  console.log('Registering test user...');
  console.log(`API: ${apiUrl}`);
  console.log(`Email: ${testUser.email}`);
  console.log(`Password: ${testUser.password}`);

  try {
    const response = await axios.post(`${apiUrl}/api/auth/register`, testUser, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.status === 200 || response.status === 201) {
      console.log('✅ SUCCESS: Test user registered');
      console.log(`   Token: ${response.data.token ? response.data.token.substring(0, 20) + '...' : 'N/A'}`);

      // Now try to login
      console.log('\nTesting login with the new user...');
      const loginResponse = await axios.post(`${apiUrl}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });

      if (loginResponse.status === 200) {
        console.log('✅ SUCCESS: Login successful');
        console.log(`   Token: ${loginResponse.data.token ? loginResponse.data.token.substring(0, 20) + '...' : 'N/A'}`);
      }
    }
  } catch (error) {
    if (error.response) {
      console.log(`❌ FAILED: Registration`);
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || error.response.data?.message || 'Unknown error'}`);

      // If user already exists, try to login
      if (error.response.status === 409 || error.response.data?.error?.includes('already')) {
        console.log('\nUser might already exist, trying login...');
        try {
          const loginResponse = await axios.post(`${apiUrl}/api/auth/login`, {
            email: testUser.email,
            password: testUser.password
          });

          if (loginResponse.status === 200) {
            console.log('✅ SUCCESS: Login successful');
            console.log(`   Token: ${loginResponse.data.token ? loginResponse.data.token.substring(0, 20) + '...' : 'N/A'}`);
          }
        } catch (loginError) {
          console.log(`❌ FAILED: Login`);
          if (loginError.response) {
            console.log(`   Status: ${loginError.response.status}`);
            console.log(`   Error: ${loginError.response.data?.error || loginError.response.data?.message || 'Unknown error'}`);
          } else {
            console.log(`   Error: ${loginError.message}`);
          }
        }
      }
    } else {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
}

registerTestUser().catch(console.error);