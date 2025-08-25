const https = require('https');
const fs = require('fs');
const path = require('path');

// List of mismatched images that need replacement
const mismatchedImages = {
  'arts_crafts.jpg': 'children painting craft colorful art',
  'badminton.jpg': 'badminton shuttlecock racket court',
  'climbing.jpg': 'kids rock climbing wall indoor',
  'community_center.jpg': 'community center building recreation',
  'diving.jpg': 'swimming pool diving board kids',
  'drums.jpg': 'drum kit percussion music children',
  'hip_hop_dance.jpg': 'hip hop dance kids street dance',
  'hockey.jpg': 'ice hockey rink kids playing',
  'ice_skating.jpg': 'ice skating rink figure skating kids',
  'karate.jpg': 'karate kids martial arts uniform',
  'kids_night_out.jpg': 'kids party evening fun activities',
  'leadership.jpg': 'kids leadership teamwork group',
  'outdoor.jpg': 'outdoor activities nature kids hiking',
  'playground.jpg': 'playground equipment kids playing swings',
  'pottery.jpg': 'pottery wheel clay kids art ceramic',
  'racquet_sports.jpg': 'tennis badminton racquet sports',
  'recreation_center.jpg': 'recreation center gym facility',
  'running.jpg': 'kids running track athletics',
  'skateboarding.jpg': 'skateboard park ramp kids',
  'stem.jpg': 'science technology kids experiment stem',
  'volleyball.jpg': 'volleyball beach net kids playing',
  'water_safety.jpg': 'swimming pool lifeguard safety kids',
  'youth_activities.jpg': 'youth teen activities sports games'
};

async function downloadFromLoremFlickr(query, filename) {
  const url = `https://loremflickr.com/800/600/${encodeURIComponent(query.replace(/ /g, ','))}/all`;
  
  return new Promise((resolve) => {
    const filePath = path.join(__dirname, '..', 'src', 'assets', 'images', 'activities', filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            const size = fs.statSync(filePath).size;
            if (size > 10000) {
              console.log(`✓ ${filename}: Downloaded ${(size/1024).toFixed(1)}KB`);
              resolve(true);
            } else {
              console.log(`✗ ${filename}: File too small (${size} bytes)`);
              resolve(false);
            }
          });
        });
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          const size = fs.statSync(filePath).size;
          if (size > 10000) {
            console.log(`✓ ${filename}: Downloaded ${(size/1024).toFixed(1)}KB`);
            resolve(true);
          } else {
            console.log(`✗ ${filename}: File too small (${size} bytes)`);
            resolve(false);
          }
        });
      }
    }).on('error', (err) => {
      console.error(`✗ ${filename}: Download failed - ${err.message}`);
      resolve(false);
    });
  });
}

async function downloadFromPlaceholder(filename, text, bgColor = '4CAF50') {
  const url = `https://via.placeholder.com/800x600/${bgColor}/FFFFFF?text=${encodeURIComponent(text)}`;
  
  return new Promise((resolve) => {
    const filePath = path.join(__dirname, '..', 'src', 'assets', 'images', 'activities', filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(filePath).size;
        console.log(`✓ ${filename}: Created placeholder (${(size/1024).toFixed(1)}KB)`);
        resolve(true);
      });
    }).on('error', (err) => {
      console.error(`✗ ${filename}: Placeholder failed - ${err.message}`);
      resolve(false);
    });
  });
}

// Color mapping for different activity types
const activityColors = {
  'arts_crafts.jpg': 'E91E63',
  'badminton.jpg': '4CAF50',
  'climbing.jpg': '795548',
  'community_center.jpg': '3F51B5',
  'diving.jpg': '00BCD4',
  'drums.jpg': 'FF5722',
  'hip_hop_dance.jpg': '9C27B0',
  'hockey.jpg': '2196F3',
  'ice_skating.jpg': '03A9F4',
  'karate.jpg': 'FF9800',
  'kids_night_out.jpg': '673AB7',
  'leadership.jpg': '009688',
  'outdoor.jpg': '4CAF50',
  'playground.jpg': 'FFC107',
  'pottery.jpg': '795548',
  'racquet_sports.jpg': '8BC34A',
  'recreation_center.jpg': '607D8B',
  'running.jpg': 'F44336',
  'skateboarding.jpg': 'FF5722',
  'stem.jpg': '3F51B5',
  'volleyball.jpg': 'FF9800',
  'water_safety.jpg': '00BCD4',
  'youth_activities.jpg': '9C27B0'
};

async function fixAllImages() {
  console.log('Starting to fix 23 mismatched images...\n');
  
  let successCount = 0;
  let placeholderCount = 0;
  
  for (const [filename, query] of Object.entries(mismatchedImages)) {
    console.log(`Processing ${filename}...`);
    
    // Try LoremFlickr first
    const success = await downloadFromLoremFlickr(query, filename);
    
    if (!success) {
      // Fallback to placeholder
      const displayName = filename.replace('.jpg', '').replace(/_/g, ' ').toUpperCase();
      const color = activityColors[filename] || '4CAF50';
      await downloadFromPlaceholder(filename, displayName, color);
      placeholderCount++;
    } else {
      successCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n=================================');
  console.log('Fix complete!');
  console.log(`Real images downloaded: ${successCount}`);
  console.log(`Placeholder images created: ${placeholderCount}`);
  console.log('Total fixed: 23 images');
  console.log('=================================');
}

// Run the fix
fixAllImages().catch(console.error);