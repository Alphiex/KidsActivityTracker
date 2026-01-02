#!/usr/bin/env node

/**
 * OpenAI DALL-E 3 Header Image Generator for KidsActivityTracker
 *
 * Usage: OPENAI_API_KEY=your_key node scripts/generate-header-images.js
 *
 * This script generates cute, flat illustration-style header images
 * matching the app's existing header illustration style.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  console.error('Usage: OPENAI_API_KEY=your_key node scripts/generate-header-images.js');
  process.exit(1);
}

const IMAGES_PATH = path.join(__dirname, '..', 'src', 'assets', 'images');

// Base style for all header illustrations
const STYLE_SUFFIX = `

STYLE REQUIREMENTS (CRITICAL - MUST FOLLOW EXACTLY):
- Simple flat illustration style, NOT photorealistic
- Cute cartoon characters with simple rounded features
- Soft pastel color palette: pink (#FFB5C5), light blue (#B5D8FF), mint green (#C5FFB5), coral (#FFB5B5), light purple (#E5B5FF)
- Clean white or very light pink background
- No harsh shadows, use soft minimal shadows only
- Characters should be simple, friendly, and child-like
- Similar style to children's app illustrations (Duolingo, Headspace Kids)
- NO complex details, keep it simple and clean
- Transparent or white background preferred
- Centered composition
- Modern, minimalist children's app aesthetic`;

const headerImages = [
  {
    name: 'browse-activity-types-header',
    prompt: `A cute flat illustration of a happy child (around 8 years old) holding a large magnifying glass, looking excited and curious. Around the child, floating in a circle, are simple rounded icons representing different activities: a soccer ball, a paintbrush and palette, a musical note, a ballet slipper, a swimming wave, and a book. The child has dark hair and wears colorful casual clothes. The icons have soft pastel colors (pink, light blue, mint green, coral). Clean, simple, friendly style.${STYLE_SUFFIX}`
  },
  {
    name: 'browse-age-groups-header',
    prompt: `A cute flat illustration showing four children of different ages standing together happily: a toddler (about 2 years old), a young child (about 5 years old), an older child (about 9 years old), and a pre-teen (about 12 years old). Each child has a distinct height showing age progression from left to right. They are all smiling and waving. Simple cartoon style with soft pastel colored clothes (pink, light blue, mint green, coral). The children represent diverse backgrounds. Clean white background.${STYLE_SUFFIX}`
  }
];

async function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',  // Square for header images
      quality: 'hd',
      style: 'vivid'  // More vibrant for illustrations
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.error) {
            reject(new Error(response.error.message || JSON.stringify(response.error)));
          } else if (response.data && response.data[0]) {
            if (response.data[0].url) {
              resolve({ type: 'url', data: response.data[0].url });
            } else if (response.data[0].b64_json) {
              resolve({ type: 'base64', data: response.data[0].b64_json });
            } else {
              reject(new Error('No image data in response'));
            }
          } else {
            reject(new Error('No image data in response'));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadImage(res.headers.location, filePath).then(resolve).catch(reject);
      } else if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
      } else {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          fs.writeFileSync(filePath, Buffer.concat(chunks));
          resolve();
        });
        res.on('error', reject);
      }
    }).on('error', reject);
  });
}

async function main() {
  console.log('Header Image Generator for KidsActivityTracker');
  console.log('='.repeat(50));
  console.log('');

  for (const image of headerImages) {
    const imagePath = path.join(IMAGES_PATH, `${image.name}.png`);

    try {
      console.log(`Generating ${image.name}.png...`);
      const result = await generateImage(image.prompt);

      if (result.type === 'url') {
        console.log('Downloading...');
        await downloadImage(result.data, imagePath);
      } else {
        console.log('Saving...');
        const buffer = Buffer.from(result.data, 'base64');
        fs.writeFileSync(imagePath, buffer);
      }

      console.log(`Saved: ${imagePath}`);
      console.log('');

      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to generate ${image.name}: ${error.message}`);
    }
  }

  console.log('Done!');
}

main().catch(console.error);
