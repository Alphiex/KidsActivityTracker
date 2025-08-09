#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

// Image download configuration
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'YOUR_UNSPLASH_ACCESS_KEY';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || 'YOUR_PEXELS_API_KEY';
const OUTPUT_DIR = path.join(__dirname, '../../assets/images/activities');

// Activity to search term mapping for child-friendly images
const activityImageMapping = {
  // Swimming
  'swimming': ['kids swimming pool', 'children swimming lessons', 'swimming pool'],
  'aquatic_leadership': ['lifeguard training', 'water safety', 'swimming pool'],
  'swimming_lessons': ['children swimming class', 'kids swim lessons', 'swimming instructor'],
  
  // Sports
  'sport': ['children playing sports', 'kids sports', 'youth athletics'],
  'basketball': ['kids basketball', 'youth basketball court', 'basketball hoop'],
  'soccer': ['children soccer', 'kids football', 'soccer field'],
  'tennis': ['kids tennis', 'tennis court', 'tennis racket'],
  'badminton': ['badminton court', 'badminton racket', 'shuttlecock'],
  'volleyball': ['volleyball net', 'beach volleyball', 'volleyball court'],
  'hockey': ['ice hockey rink', 'hockey sticks', 'ice skating'],
  'skating': ['ice skating rink', 'figure skating', 'ice skates'],
  'martial_arts': ['kids karate', 'martial arts dojo', 'taekwondo'],
  'gymnastics': ['gymnastics equipment', 'balance beam', 'gymnastics mat'],
  
  // Arts & Crafts
  'art': ['kids art class', 'children painting', 'art supplies'],
  'pottery': ['pottery wheel', 'clay crafts', 'ceramics studio'],
  'painting': ['kids painting', 'art easel', 'paint brushes'],
  'drawing': ['colored pencils', 'kids drawing', 'art supplies'],
  'crafts': ['kids crafts', 'craft supplies', 'creative activities'],
  
  // Dance & Music
  'dance': ['dance studio', 'ballet shoes', 'dance floor'],
  'ballet': ['ballet studio', 'ballet barre', 'tutu'],
  'music': ['music notes', 'piano keys', 'musical instruments'],
  'piano': ['piano keyboard', 'music sheets', 'piano keys'],
  'guitar': ['acoustic guitar', 'guitar strings', 'music lesson'],
  'drums': ['drum set', 'drumsticks', 'percussion'],
  
  // Fitness & Wellness
  'fitness': ['kids fitness', 'exercise equipment', 'gym'],
  'yoga': ['yoga mat', 'yoga studio', 'meditation'],
  'climbing': ['climbing wall', 'rock climbing', 'climbing holds'],
  
  // Educational
  'stem': ['science experiment', 'robotics', 'kids coding'],
  'science': ['science lab', 'microscope', 'experiments'],
  'technology': ['computer lab', 'coding', 'robotics'],
  'engineering': ['building blocks', 'lego', 'construction'],
  'cooking': ['kids cooking', 'kitchen', 'chef hat'],
  'language': ['language learning', 'books', 'alphabet'],
  
  // Outdoor & Nature
  'outdoor': ['nature trail', 'outdoor adventure', 'forest'],
  'camping': ['tent camping', 'campfire', 'outdoor adventure'],
  'hiking': ['hiking trail', 'nature walk', 'mountains'],
  'nature': ['forest path', 'nature', 'outdoors'],
  
  // Early Years
  'early_years': ['playground', 'toddler activities', 'preschool'],
  'playtime': ['playground equipment', 'kids playing', 'toys'],
  'toddler': ['toddler toys', 'playroom', 'early learning'],
  
  // Camps
  'camp': ['summer camp', 'camp activities', 'outdoor camp'],
  'day_camp': ['day camp activities', 'camp games', 'summer fun'],
  
  // Life Skills
  'babysitting': ['childcare', 'first aid kit', 'safety'],
  'first_aid': ['first aid kit', 'medical supplies', 'safety'],
  'leadership': ['teamwork', 'leadership', 'group activities'],
  
  // General/Default
  'default': ['community center', 'recreation center', 'activity center']
};

// Function to ensure directory exists
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Function to download image from URL
async function downloadImage(url, filepath) {
  const writer = createWriteStream(filepath);
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      response.pipe(writer);
      writer.on('finish', () => {
        writer.close();
        resolve();
      });
      writer.on('error', reject);
    }).on('error', reject);
  });
}

// Function to search Unsplash for images
async function searchUnsplashImages(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.results || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Function to search for free stock images (placeholder - implement with actual API)
async function searchFreeImages(query) {
  console.log(`Searching for: ${query}`);
  // This is a placeholder - you would implement actual API calls here
  // For now, we'll create a mapping file that can be used to manually add images
  return [];
}

// Main function to process all activity types
async function downloadActivityImages() {
  ensureDirectoryExists(OUTPUT_DIR);
  
  const imageMapping = {};
  const failedDownloads = [];
  
  console.log('Starting image download process...\n');
  
  for (const [activityKey, searchTerms] of Object.entries(activityImageMapping)) {
    console.log(`\nProcessing ${activityKey}...`);
    
    let imageFound = false;
    let selectedImage = null;
    
    // Try each search term until we find a suitable image
    for (const searchTerm of searchTerms) {
      try {
        // For demonstration, we'll just record what images we need
        // In production, you'd use actual image search APIs
        console.log(`  - Searching for: "${searchTerm}"`);
        
        // Record the search intent
        if (!imageFound) {
          selectedImage = {
            activityKey,
            searchTerm,
            status: 'pending',
            filename: `${activityKey}.jpg`
          };
          imageFound = true;
        }
      } catch (error) {
        console.error(`  - Error searching for "${searchTerm}": ${error.message}`);
      }
    }
    
    if (selectedImage) {
      imageMapping[activityKey] = selectedImage;
    } else {
      failedDownloads.push(activityKey);
    }
  }
  
  // Save the mapping configuration
  const mappingPath = path.join(__dirname, '../activity-image-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(imageMapping, null, 2));
  
  console.log('\n=== Download Summary ===');
  console.log(`Total activity types: ${Object.keys(activityImageMapping).length}`);
  console.log(`Images to download: ${Object.keys(imageMapping).length}`);
  console.log(`Failed: ${failedDownloads.length}`);
  
  if (failedDownloads.length > 0) {
    console.log('\nFailed downloads:');
    failedDownloads.forEach(key => console.log(`  - ${key}`));
  }
  
  console.log(`\nMapping saved to: ${mappingPath}`);
  console.log('\nNext steps:');
  console.log('1. Add your Unsplash/Pexels API keys to environment variables');
  console.log('2. Manually download child-friendly images for each activity type');
  console.log('3. Place images in: assets/images/activities/');
  console.log('4. Update the app to use these new images');
}

// Create a detailed activity mapping based on database categories
async function createDetailedActivityMapping() {
  const dbCategories = JSON.parse(fs.readFileSync(path.join(__dirname, '../activity-categories-simple-2025-08-09.json'), 'utf8'));
  
  const detailedMapping = {};
  
  dbCategories.forEach(item => {
    const key = item.category.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!detailedMapping[key]) {
      detailedMapping[key] = {
        category: item.category,
        subcategories: [],
        searchTerms: activityImageMapping[key] || activityImageMapping.default
      };
    }
    if (item.subcategory) {
      detailedMapping[key].subcategories.push(item.subcategory);
    }
  });
  
  const detailPath = path.join(__dirname, '../detailed-activity-image-mapping.json');
  fs.writeFileSync(detailPath, JSON.stringify(detailedMapping, null, 2));
  console.log(`\nDetailed mapping saved to: ${detailPath}`);
}

// Run the script
(async () => {
  try {
    await downloadActivityImages();
    await createDetailedActivityMapping();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();