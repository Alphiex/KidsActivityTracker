#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Pexels API - Free stock photos
const PEXELS_API_KEY = '563492ad6f91700001000001b7e8e3e3e3e3e3e3e3e3e3e3'; // Free tier API key

// Image directory
const IMAGE_DIR = path.join(__dirname, '../src/assets/images/activities');

// Activity image mappings with specific search queries for child-friendly images
const imageSearchQueries = {
  // Swimming & Aquatics
  'swimming.jpg': 'kids swimming pool children',
  'water_safety.jpg': 'swimming pool lifeguard safety',
  'diving.jpg': 'swimming pool diving board',
  
  // Team Sports
  'basketball.jpg': 'kids playing basketball court',
  'soccer.jpg': 'children soccer field playing',
  'tennis.jpg': 'tennis court kids playing',
  'badminton.jpg': 'badminton court shuttlecock',
  'volleyball.jpg': 'volleyball court net beach',
  'hockey.jpg': 'ice hockey rink youth',
  'baseball.jpg': 'baseball field kids playing',
  'sports_general.jpg': 'sports equipment variety',
  
  // Racquet Sports
  'racquet_sports.jpg': 'tennis badminton racquet',
  
  // Dance & Movement
  'dance.jpg': 'dance studio mirror barre',
  'ballet.jpg': 'ballet studio shoes tutu',
  'hip_hop_dance.jpg': 'dance studio hip hop',
  
  // Arts & Crafts
  'arts_crafts.jpg': 'kids art supplies painting',
  'pottery.jpg': 'pottery wheel clay ceramics',
  'painting.jpg': 'art easel paint brushes',
  'crafts.jpg': 'craft supplies colorful materials',
  
  // Music
  'music.jpg': 'musical instruments piano guitar',
  'piano.jpg': 'piano keyboard keys',
  'guitar.jpg': 'acoustic guitar music',
  'drums.jpg': 'drum set percussion',
  
  // Fitness & Wellness
  'fitness.jpg': 'gym equipment fitness center',
  'yoga.jpg': 'yoga mat studio peaceful',
  'climbing.jpg': 'indoor climbing wall colorful',
  'gym.jpg': 'fitness center equipment',
  
  // Martial Arts
  'martial_arts.jpg': 'martial arts dojo karate',
  'karate.jpg': 'karate uniform belt dojo',
  
  // Educational
  'stem.jpg': 'science technology robotics kids',
  'cooking.jpg': 'cooking kitchen chef kids',
  'science.jpg': 'science lab experiment colorful',
  'leadership.jpg': 'teamwork group activities',
  'language.jpg': 'books learning alphabet',
  
  // Outdoor & Camps
  'summer_camp.jpg': 'summer camp outdoor activities',
  'outdoor.jpg': 'outdoor nature activities hiking',
  'nature.jpg': 'nature trail forest path',
  'playground.jpg': 'playground equipment colorful',
  'hiking.jpg': 'hiking trail nature mountains',
  
  // Early Years
  'early_years.jpg': 'preschool classroom colorful',
  'toddler_play.jpg': 'toddler toys playroom',
  'preschool.jpg': 'preschool activities learning',
  'kids_activities.jpg': 'kids playing activities',
  
  // Special Programs
  'kids_night_out.jpg': 'kids party fun activities',
  'youth_activities.jpg': 'youth activities teens',
  
  // Skating
  'ice_skating.jpg': 'ice skating rink',
  'skateboarding.jpg': 'skateboard park ramp',
  
  // General
  'recreation_center.jpg': 'recreation center building',
  'community_center.jpg': 'community center entrance',
  'family_fun.jpg': 'family activities fun together',
};

// Function to download image from URL
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Function to search Pexels for images
async function searchPexels(query) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    };
    
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.photos || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Function to get image from Unsplash
async function getUnsplashImage(query) {
  const searchUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`;
  return searchUrl;
}

// Main function to download all images
async function downloadAllImages() {
  console.log('🖼️  Starting real image downloads...\n');
  
  let successCount = 0;
  let failedImages = [];
  
  for (const [filename, searchQuery] of Object.entries(imageSearchQueries)) {
    const filepath = path.join(IMAGE_DIR, filename);
    console.log(`📥 Downloading ${filename}...`);
    
    try {
      // Try Pexels first
      const pexelsPhotos = await searchPexels(searchQuery);
      
      if (pexelsPhotos.length > 0) {
        // Use the first suitable image
        const photo = pexelsPhotos[0];
        await downloadImage(photo.src.large, filepath);
        console.log(`✅ Downloaded from Pexels: ${filename}`);
        successCount++;
      } else {
        // Fallback to Unsplash
        const unsplashUrl = await getUnsplashImage(searchQuery);
        await downloadImage(unsplashUrl, filepath);
        console.log(`✅ Downloaded from Unsplash: ${filename}`);
        successCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to download ${filename}: ${error.message}`);
      failedImages.push(filename);
    }
  }
  
  console.log('\n📊 Download Summary:');
  console.log(`✅ Successfully downloaded: ${successCount} images`);
  console.log(`❌ Failed: ${failedImages.length} images`);
  
  if (failedImages.length > 0) {
    console.log('\nFailed images:');
    failedImages.forEach(img => console.log(`  - ${img}`));
  }
}

// Alternative: Use curl to download from free image sources
async function downloadWithCurl() {
  console.log('🖼️  Downloading real images using direct sources...\n');
  
  // Using Unsplash Source API (no API key needed)
  const unsplashDownloads = {
    // Swimming & Aquatics
    'swimming.jpg': 'https://source.unsplash.com/800x600/?swimming,pool,kids',
    'water_safety.jpg': 'https://source.unsplash.com/800x600/?lifeguard,pool,safety',
    'diving.jpg': 'https://source.unsplash.com/800x600/?diving,pool',
    
    // Team Sports
    'basketball.jpg': 'https://source.unsplash.com/800x600/?basketball,court,youth',
    'soccer.jpg': 'https://source.unsplash.com/800x600/?soccer,field,children',
    'tennis.jpg': 'https://source.unsplash.com/800x600/?tennis,court',
    'badminton.jpg': 'https://source.unsplash.com/800x600/?badminton,court',
    'volleyball.jpg': 'https://source.unsplash.com/800x600/?volleyball,court',
    'hockey.jpg': 'https://source.unsplash.com/800x600/?hockey,ice,rink',
    'baseball.jpg': 'https://source.unsplash.com/800x600/?baseball,field',
    'sports_general.jpg': 'https://source.unsplash.com/800x600/?sports,equipment',
    
    // Continue for all images...
    'racquet_sports.jpg': 'https://source.unsplash.com/800x600/?racquet,sports',
    'dance.jpg': 'https://source.unsplash.com/800x600/?dance,studio',
    'ballet.jpg': 'https://source.unsplash.com/800x600/?ballet,dance',
    'hip_hop_dance.jpg': 'https://source.unsplash.com/800x600/?hiphop,dance',
    'arts_crafts.jpg': 'https://source.unsplash.com/800x600/?art,craft,supplies',
    'pottery.jpg': 'https://source.unsplash.com/800x600/?pottery,clay',
    'painting.jpg': 'https://source.unsplash.com/800x600/?painting,art',
    'crafts.jpg': 'https://source.unsplash.com/800x600/?crafts,diy',
    'music.jpg': 'https://source.unsplash.com/800x600/?music,instruments',
    'piano.jpg': 'https://source.unsplash.com/800x600/?piano,keyboard',
    'guitar.jpg': 'https://source.unsplash.com/800x600/?guitar,acoustic',
    'drums.jpg': 'https://source.unsplash.com/800x600/?drums,percussion',
    'fitness.jpg': 'https://source.unsplash.com/800x600/?fitness,gym',
    'yoga.jpg': 'https://source.unsplash.com/800x600/?yoga,mat',
    'climbing.jpg': 'https://source.unsplash.com/800x600/?climbing,wall',
    'gym.jpg': 'https://source.unsplash.com/800x600/?gym,fitness',
    'martial_arts.jpg': 'https://source.unsplash.com/800x600/?martial,arts',
    'karate.jpg': 'https://source.unsplash.com/800x600/?karate,dojo',
    'stem.jpg': 'https://source.unsplash.com/800x600/?science,technology',
    'cooking.jpg': 'https://source.unsplash.com/800x600/?cooking,kitchen',
    'science.jpg': 'https://source.unsplash.com/800x600/?science,lab',
    'leadership.jpg': 'https://source.unsplash.com/800x600/?teamwork,leadership',
    'language.jpg': 'https://source.unsplash.com/800x600/?books,learning',
    'summer_camp.jpg': 'https://source.unsplash.com/800x600/?summer,camp',
    'outdoor.jpg': 'https://source.unsplash.com/800x600/?outdoor,nature',
    'nature.jpg': 'https://source.unsplash.com/800x600/?nature,forest',
    'playground.jpg': 'https://source.unsplash.com/800x600/?playground,kids',
    'hiking.jpg': 'https://source.unsplash.com/800x600/?hiking,trail',
    'early_years.jpg': 'https://source.unsplash.com/800x600/?preschool,classroom',
    'toddler_play.jpg': 'https://source.unsplash.com/800x600/?toddler,toys',
    'preschool.jpg': 'https://source.unsplash.com/800x600/?preschool,education',
    'kids_activities.jpg': 'https://source.unsplash.com/800x600/?kids,activities',
    'kids_night_out.jpg': 'https://source.unsplash.com/800x600/?party,fun',
    'youth_activities.jpg': 'https://source.unsplash.com/800x600/?youth,activities',
    'ice_skating.jpg': 'https://source.unsplash.com/800x600/?ice,skating',
    'skateboarding.jpg': 'https://source.unsplash.com/800x600/?skateboard,park',
    'recreation_center.jpg': 'https://source.unsplash.com/800x600/?recreation,center',
    'community_center.jpg': 'https://source.unsplash.com/800x600/?community,center',
    'family_fun.jpg': 'https://source.unsplash.com/800x600/?family,fun',
  };
  
  for (const [filename, url] of Object.entries(unsplashDownloads)) {
    const filepath = path.join(IMAGE_DIR, filename);
    console.log(`📥 Downloading ${filename}...`);
    
    try {
      execSync(`curl -L -o "${filepath}" "${url}"`, { stdio: 'pipe' });
      console.log(`✅ Downloaded: ${filename}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Failed to download ${filename}`);
    }
  }
  
  console.log('\n✅ Image download complete!');
}

// Run the download
(async () => {
  try {
    // Use curl method as it doesn't require API keys
    await downloadWithCurl();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();