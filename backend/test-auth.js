const axios = require('axios');

const API_URL = 'https://kids-activity-api-205843686007.us-central1.run.app';

async function testAuth() {
  console.log('Testing authentication endpoints...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);

    // Test registration
    console.log('\n2. Testing registration endpoint...');
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      phoneNumber: '1234567890'
    };

    try {
      const registerResponse = await axios.post(`${API_URL}/api/auth/register`, testUser);
      console.log('✅ Registration successful:', registerResponse.data);

      // Test login with the same user
      console.log('\n3. Testing login endpoint...');
      const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });
      console.log('✅ Login successful:', loginResponse.data);

      // Test token verification
      console.log('\n4. Testing token verification...');
      const token = loginResponse.data.tokens.accessToken;
      const checkResponse = await axios.get(`${API_URL}/api/auth/check`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('✅ Token verification successful:', checkResponse.data);

    } catch (error) {
      if (error.response?.status === 404) {
        console.error('❌ Auth endpoints not found. The deployed server may not have auth routes.');
      } else {
        console.error('❌ Auth test failed:', error.response?.data || error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAuth();