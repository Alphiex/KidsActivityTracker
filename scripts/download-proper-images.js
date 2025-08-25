const https = require('https');
const fs = require('fs');
const path = require('path');

// Using placeholder images that represent the activities
const activityImages = {
  'ice_skating.jpg': {
    width: 800,
    height: 600,
    text: 'Ice Skating',
    bgColor: '87CEEB', // Sky blue
    textColor: 'FFFFFF'
  },
  'volleyball.jpg': {
    width: 800,
    height: 600,
    text: 'Volleyball',
    bgColor: 'F4A460', // Sandy brown
    textColor: 'FFFFFF'
  },
  'running.jpg': {
    width: 800,
    height: 600,
    text: 'Running',
    bgColor: '90EE90', // Light green
    textColor: '333333'
  }
};

function downloadPlaceholderImage(filename, config) {
  return new Promise((resolve, reject) => {
    const url = `https://via.placeholder.com/${config.width}x${config.height}/${config.bgColor}/${config.textColor}?text=${encodeURIComponent(config.text)}`;
    const filePath = path.join(__dirname, '..', 'src', 'assets', 'images', 'activities', filename);
    
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded: ${filename}`);
        resolve(true);
      });
      
      file.on('error', (err) => {
        fs.unlink(filePath, () => {});
        console.error(`✗ Failed to download ${filename}:`, err.message);
        reject(err);
      });
    }).on('error', (err) => {
      console.error(`✗ Failed to download ${filename}:`, err.message);
      reject(err);
    });
  });
}

async function downloadAll() {
  console.log('Downloading placeholder images for activities...\n');
  
  for (const [filename, config] of Object.entries(activityImages)) {
    try {
      await downloadPlaceholderImage(filename, config);
    } catch (err) {
      console.error(`Error with ${filename}:`, err.message);
    }
  }
  
  console.log('\nDone!');
}

downloadAll().catch(console.error);