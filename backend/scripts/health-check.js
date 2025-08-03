#!/usr/bin/env node

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds

async function checkHealth() {
  try {
    console.log(`Checking health of ${API_URL}...`);
    
    const startTime = Date.now();
    const response = await axios.get(`${API_URL}/health`, {
      timeout: TIMEOUT
    });
    const responseTime = Date.now() - startTime;
    
    if (response.data.status === 'healthy') {
      console.log('✅ API is healthy');
      console.log(`Response time: ${responseTime}ms`);
      console.log('Environment:', response.data.environment);
      console.log('Timestamp:', response.data.timestamp);
      
      // Check database connectivity
      try {
        const statsResponse = await axios.get(`${API_URL}/api/v1/activities/stats/summary`, {
          timeout: TIMEOUT
        });
        
        if (statsResponse.data.success) {
          console.log('✅ Database connection is healthy');
          console.log(`Total activities: ${statsResponse.data.stats.totalActive}`);
        }
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError.message);
        process.exit(1);
      }
      
      process.exit(0);
    } else {
      console.error('❌ API returned unhealthy status');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

checkHealth();