#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load the activity categories from the database scan
const categoriesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../activity-categories-simple-2025-08-09.json'), 'utf8')
);

// Define all unique image keys we need
const imageKeys = new Set([
  // Swimming & Aquatics
  'swimming',
  'water_safety',
  'diving',
  
  // Team Sports
  'basketball',
  'soccer',
  'tennis',
  'badminton',
  'volleyball',
  'hockey',
  'baseball',
  'sports_general',
  
  // Racquet Sports
  'racquet_sports',
  
  // Dance & Movement
  'dance',
  'ballet',
  'hip_hop_dance',
  
  // Arts & Crafts
  'arts_crafts',
  'pottery',
  'painting',
  'crafts',
  
  // Music
  'music',
  'piano',
  'guitar',
  'drums',
  
  // Fitness & Wellness
  'fitness',
  'yoga',
  'climbing',
  'gym',
  
  // Martial Arts
  'martial_arts',
  'karate',
  
  // Educational
  'stem',
  'cooking',
  'science',
  'leadership',
  'language',
  
  // Outdoor & Camps
  'summer_camp',
  'outdoor',
  'nature',
  'playground',
  'hiking',
  
  // Early Years
  'early_years',
  'toddler_play',
  'preschool',
  'kids_activities',
  
  // Special Programs
  'kids_night_out',
  'youth_activities',
  
  // Skating
  'ice_skating',
  'skateboarding',
  
  // General
  'recreation_center',
  'community_center',
  'family_fun',
]);

// Define search terms for each image key
const imageSearchTerms = {
  // Swimming & Aquatics
  'swimming': 'kids swimming pool children swimming lessons',
  'water_safety': 'water safety lifeguard training pool',
  'diving': 'diving board swimming pool',
  
  // Team Sports
  'basketball': 'kids playing basketball youth basketball court',
  'soccer': 'children playing soccer kids football field',
  'tennis': 'kids tennis lessons tennis court children',
  'badminton': 'badminton court shuttlecock racket',
  'volleyball': 'volleyball court net beach volleyball',
  'hockey': 'youth ice hockey rink kids hockey',
  'baseball': 'kids baseball field youth baseball',
  'sports_general': 'kids playing sports youth athletics',
  
  // Racquet Sports
  'racquet_sports': 'racquet sports court tennis badminton',
  
  // Dance & Movement
  'dance': 'kids dance studio children dancing ballet',
  'ballet': 'ballet studio barre children ballet class',
  'hip_hop_dance': 'kids hip hop dance studio',
  
  // Arts & Crafts
  'arts_crafts': 'kids art class children painting crafts',
  'pottery': 'pottery wheel clay kids ceramics',
  'painting': 'kids painting art easel children art',
  'crafts': 'kids crafts supplies creative activities',
  
  // Music
  'music': 'music instruments kids music class',
  'piano': 'piano keyboard music lessons children',
  'guitar': 'acoustic guitar kids music lesson',
  'drums': 'drum set kids percussion music',
  
  // Fitness & Wellness
  'fitness': 'kids fitness exercise children gym',
  'yoga': 'kids yoga mat children yoga class',
  'climbing': 'kids climbing wall indoor rock climbing',
  'gym': 'fitness center exercise equipment',
  
  // Martial Arts
  'martial_arts': 'kids martial arts dojo karate children',
  'karate': 'kids karate class martial arts uniform',
  
  // Educational
  'stem': 'kids science experiment robotics coding',
  'cooking': 'kids cooking class children kitchen chef',
  'science': 'science lab kids experiments learning',
  'leadership': 'teamwork kids leadership activities',
  'language': 'language learning kids books alphabet',
  
  // Outdoor & Camps
  'summer_camp': 'summer camp kids outdoor activities',
  'outdoor': 'outdoor adventure kids nature activities',
  'nature': 'nature trail kids hiking forest',
  'playground': 'playground equipment kids playing',
  'hiking': 'kids hiking trail nature walk',
  
  // Early Years
  'early_years': 'toddler playground preschool activities',
  'toddler_play': 'toddler playroom toys early learning',
  'preschool': 'preschool classroom kids learning',
  'kids_activities': 'kids activities recreation center',
  
  // Special Programs
  'kids_night_out': 'kids fun activities games night',
  'youth_activities': 'youth programs teen activities',
  
  // Skating
  'ice_skating': 'ice skating rink kids figure skating',
  'skateboarding': 'skateboard park kids skating',
  
  // General
  'recreation_center': 'community recreation center building',
  'community_center': 'community center activities building',
  'family_fun': 'family activities kids parents fun',
};

// Generate download list
const downloadList = [];
imageKeys.forEach(key => {
  downloadList.push({
    imageKey: key,
    filename: `${key}.jpg`,
    searchTerms: imageSearchTerms[key] || key.replace(/_/g, ' '),
    category: getCategoryForImageKey(key),
    requirements: [
      'Child-friendly or no people',
      'High quality',
      'Bright and engaging',
      'Safe and appropriate for kids app'
    ]
  });
});

// Helper function to determine category
function getCategoryForImageKey(key) {
  if (['swimming', 'water_safety', 'diving'].includes(key)) return 'Aquatics';
  if (['basketball', 'soccer', 'tennis', 'badminton', 'volleyball', 'hockey', 'baseball', 'sports_general', 'racquet_sports'].includes(key)) return 'Sports';
  if (['dance', 'ballet', 'hip_hop_dance'].includes(key)) return 'Dance';
  if (['arts_crafts', 'pottery', 'painting', 'crafts'].includes(key)) return 'Arts';
  if (['music', 'piano', 'guitar', 'drums'].includes(key)) return 'Music';
  if (['fitness', 'yoga', 'climbing', 'gym'].includes(key)) return 'Fitness';
  if (['martial_arts', 'karate'].includes(key)) return 'Martial Arts';
  if (['stem', 'cooking', 'science', 'leadership', 'language'].includes(key)) return 'Educational';
  if (['summer_camp', 'outdoor', 'nature', 'playground', 'hiking'].includes(key)) return 'Outdoor';
  if (['early_years', 'toddler_play', 'preschool', 'kids_activities'].includes(key)) return 'Early Years';
  if (['ice_skating', 'skateboarding'].includes(key)) return 'Skating';
  return 'General';
}

// Save the download list
const outputPath = path.join(__dirname, '../image-download-list.json');
fs.writeFileSync(outputPath, JSON.stringify({
  totalImages: downloadList.length,
  generatedAt: new Date().toISOString(),
  images: downloadList
}, null, 2));

// Generate a CSV for easy reference
const csvPath = path.join(__dirname, '../image-download-list.csv');
const csvContent = [
  'Image Key,Filename,Category,Search Terms',
  ...downloadList.map(item => 
    `"${item.imageKey}","${item.filename}","${item.category}","${item.searchTerms}"`
  )
].join('\n');
fs.writeFileSync(csvPath, csvContent);

// Generate markdown documentation
const mdPath = path.join(__dirname, '../IMAGE_DOWNLOAD_GUIDE.md');
const mdContent = `# Kids Activity Tracker - Image Download Guide

## Overview
This guide lists all the images needed for the Kids Activity Tracker app. All images should be:
- Child-friendly (featuring children or no people)
- High quality and bright
- Appropriate for a kids' activity app
- Landscape orientation preferred

## Total Images Needed: ${downloadList.length}

## Images by Category

${Object.entries(downloadList.reduce((acc, item) => {
  if (!acc[item.category]) acc[item.category] = [];
  acc[item.category].push(item);
  return acc;
}, {})).map(([category, items]) => `
### ${category} (${items.length} images)

${items.map(item => `- **${item.imageKey}.jpg**: ${item.searchTerms}`).join('\n')}
`).join('\n')}

## Where to Save Images

Save all images to: \`/assets/images/activities/\`

## Recommended Image Sources

1. **Unsplash** (https://unsplash.com) - Free high-quality photos
2. **Pexels** (https://pexels.com) - Free stock photos
3. **Pixabay** (https://pixabay.com) - Free images
4. **Freepik** (https://freepik.com) - Free and premium images

## Search Tips

- Add "kids" or "children" to searches
- Look for images without identifiable faces when possible
- Choose bright, colorful, engaging images
- Avoid images with adult-only activities
`;

fs.writeFileSync(mdPath, mdContent);

console.log('✅ Image download list generated successfully!');
console.log(`📄 JSON list: ${outputPath}`);
console.log(`📊 CSV list: ${csvPath}`);
console.log(`📖 Guide: ${mdPath}`);
console.log(`\nTotal images needed: ${downloadList.length}`);