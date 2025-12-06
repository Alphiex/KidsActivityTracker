#!/usr/bin/env node

// Force reload React Native app
const axios = require('axios');

async function reloadApp() {
  try {
    console.log('🔄 Forcing React Native app reload...');
    
    // Send reload command to Metro
    const response = await axios.post('http://localhost:8081/reload', {}, {
      timeout: 5000
    });
    
    console.log('✅ App reload command sent successfully');
  } catch (error) {
    console.log('⚠️  Could not send reload command:', error.message);
    console.log('💡 Make sure Metro is running and try manual reload (Cmd+R in simulator)');
  }
}

reloadApp();