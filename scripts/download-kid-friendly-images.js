const https = require('https');
const fs = require('fs');
const path = require('path');

// Pexels API configuration
const PEXELS_API_KEY = 'XJqEPAu5zKqGzKFDlqGhCqJKKqPzYFYH8zPvGmNpLDpKpH7Bjqx5NqPz';

// Activity image mappings with kid-friendly search terms
const activityImages = {
  'ice_skating.jpg': 'children ice skating rink fun',
  'swimming.jpg': 'kids swimming pool fun',
  'water_safety.jpg': 'children swimming lessons safety',
  'diving.jpg': 'kids diving pool',
  'basketball.jpg': 'children playing basketball',
  'soccer.jpg': 'kids soccer game field',
  'tennis.jpg': 'children tennis court lesson',
  'badminton.jpg': 'kids badminton playing',
  'volleyball.jpg': 'children volleyball beach',
  'hockey.jpg': 'kids ice hockey rink',
  'baseball.jpg': 'children baseball field',
  'sports_general.jpg': 'kids sports activities',
  'racquet_sports.jpg': 'children racquet sports',
  'dance.jpg': 'kids dance class studio',
  'ballet.jpg': 'children ballet class pink',
  'hip_hop_dance.jpg': 'kids hip hop dancing',
  'arts_crafts.jpg': 'children art craft painting',
  'pottery.jpg': 'kids pottery clay wheel',
  'painting.jpg': 'children painting art class',
  'crafts.jpg': 'kids crafts activities colorful',
  'music.jpg': 'children music instruments class',
  'piano.jpg': 'kid playing piano lesson',
  'guitar.jpg': 'child guitar music lesson',
  'drums.jpg': 'kids drums percussion music',
  'fitness.jpg': 'children exercise fitness fun',
  'yoga.jpg': 'kids yoga class mat',
  'climbing.jpg': 'children rock climbing wall',
  'gym.jpg': 'kids gym exercise activities',
  'martial_arts.jpg': 'children karate martial arts',
  'karate.jpg': 'kids karate uniform dojo',
  'stem.jpg': 'children science experiment learning',
  'cooking.jpg': 'kids cooking class kitchen',
  'science.jpg': 'children science experiment lab',
  'leadership.jpg': 'kids teamwork leadership activities',
  'language.jpg': 'children learning language class',
  'summer_camp.jpg': 'kids summer camp outdoor',
  'outdoor.jpg': 'children outdoor activities nature',
  'nature.jpg': 'kids nature exploration hiking',
  'playground.jpg': 'children playground playing fun',
  'hiking.jpg': 'kids hiking trail nature',
  'early_years.jpg': 'toddler play activities learning',
  'toddler_play.jpg': 'toddler playing toys colorful',
  'preschool.jpg': 'preschool children activities',
  'kids_activities.jpg': 'children activities playing fun',
  'kids_night_out.jpg': 'kids party fun activities',
  'youth_activities.jpg': 'youth teen activities sports',
  'skateboarding.jpg': 'kids skateboard park ramp',
  'recreation_center.jpg': 'community recreation center building',
  'community_center.jpg': 'community center activities building',
  'family_fun.jpg': 'family activities children fun'
};

async function downloadImageFromPexels(query, filename) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    };

    https.get(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.photos && result.photos.length > 0) {
            // Get the first photo's large size URL
            const imageUrl = result.photos[0].src.large;
            downloadImage(imageUrl, filename)
              .then(resolve)
              .catch(reject);
          } else {
            console.log(`No images found for: ${query}`);
            resolve(false);
          }
        } catch (err) {
          console.error(`Error parsing response for ${query}:`, err.message);
          resolve(false);
        }
      });
    }).on('error', reject);
  });
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
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
        fs.unlink(filePath, () => {}); // Delete the file on error
        console.error(`✗ Failed to download ${filename}:`, err.message);
        reject(err);
      });
    }).on('error', (err) => {
      console.error(`✗ Failed to download ${filename}:`, err.message);
      reject(err);
    });
  });
}

async function downloadAllImages() {
  console.log('Starting download of kid-friendly activity images...\n');
  
  const entries = Object.entries(activityImages);
  let successCount = 0;
  let failCount = 0;
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(entries.length/batchSize)}...`);
    
    const promises = batch.map(async ([filename, query]) => {
      try {
        console.log(`Searching for: ${filename} with query: "${query}"`);
        const success = await downloadImageFromPexels(query, filename);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`Error downloading ${filename}:`, err.message);
        failCount++;
      }
    });
    
    await Promise.all(promises);
    
    // Wait 2 seconds between batches to respect rate limits
    if (i + batchSize < entries.length) {
      console.log('Waiting before next batch...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n=================================');
  console.log(`Download complete!`);
  console.log(`Successfully downloaded: ${successCount} images`);
  console.log(`Failed: ${failCount} images`);
  console.log('=================================');
}

// Run the download
downloadAllImages().catch(console.error);