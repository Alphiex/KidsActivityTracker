#!/usr/bin/env node
/**
 * Retry Failed Images with Modified Safe Prompts
 * Uses illustration style and activity-focused language to avoid false positives
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_PATH = path.join(__dirname, '../../src/assets/images/activities');

// Failed images with safer, illustration-focused prompts
const RETRY_IMAGES = [
  {
    path: 'swimming_aquatics/type_swimming_aquatics.png',
    prompt: 'Cheerful illustrated scene of a youth aquatics program at an indoor recreation center pool. Cartoon style showing happy young swimmers in athletic team swimwear practicing with kickboards and pool noodles. Bright blue pool water, lane dividers, friendly coach on deck. Warm welcoming atmosphere, family-friendly youth sports illustration. Clean wholesome educational illustration style.',
  },
  {
    path: 'swimming_aquatics/diving.png',
    prompt: 'Illustrated cartoon of a youth springboard diving class at a recreation center. Young diver in athletic dive suit standing confidently on low diving board, arms raised in preparation. Focus on the diving board, pool edge, and excitement of the sport. Cartoon illustration style, bright cheerful colors, family-friendly sports education visual.',
  },
  {
    path: 'swimming_aquatics/synchronized_swimming.png',
    prompt: 'Illustrated artistic swimming team practice scene. Young athletes in matching team athletic suits performing arm movements above the water in synchronized formation. Focus on teamwork, coordination, and artistry of the sport. Bright pool setting, cartoon illustration style, wholesome youth sports program visual.',
  },
  {
    path: 'gymnastics_movement/type_gymnastics_movement.png',
    prompt: 'Cheerful illustrated gymnastics class at a youth recreation center. Happy young gymnasts in colorful leotards practicing on balance beam and floor mats. Coach assisting, chalk dust in air, medal ribbons on wall. Bright gymnasium setting, cartoon illustration style, family-friendly youth sports education visual.',
  },
  {
    path: 'gymnastics_movement/tumbling.png',
    prompt: 'Illustrated youth tumbling class scene. Young athletes in athletic wear practicing cartwheels and forward rolls on thick blue gymnastics mats. Spotting coach nearby, foam pit in background. Bright cheerful gymnasium, cartoon illustration style, wholesome youth fitness program visual.',
  },
  {
    path: 'dance/jazz_dance.png',
    prompt: 'Illustrated jazz dance class at a youth performing arts studio. Happy young dancers in colorful dance attire striking dynamic poses with jazz hands. Dance studio mirrors, wooden floor, upbeat atmosphere. Cartoon illustration style, bright cheerful colors, family-friendly performing arts education visual.',
  },
];

async function generateImage(imagePath, prompt) {
  const fullPath = path.join(BASE_PATH, imagePath);
  const dir = path.dirname(fullPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`\n🎨 Retrying: ${imagePath}`);
  console.log(`   Prompt: ${prompt.substring(0, 80)}...`);

  try {
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const imageUrl = response.data[0].url || response.data[0].b64_json;

    if (response.data[0].b64_json) {
      // Base64 response
      const buffer = Buffer.from(response.data[0].b64_json, 'base64');
      fs.writeFileSync(fullPath, buffer);
    } else if (imageUrl) {
      // URL response - fetch and save
      const fetch = (await import('node-fetch')).default;
      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.buffer();
      fs.writeFileSync(fullPath, buffer);
    }

    console.log(`   ✅ Saved successfully!`);
    return true;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);

    // If still failing, try with even safer "icon" style prompt
    if (error.message.includes('safety')) {
      console.log(`   🔄 Trying icon/symbol style...`);
      return await tryIconStyle(imagePath, prompt);
    }
    return false;
  }
}

async function tryIconStyle(imagePath, originalPrompt) {
  const fullPath = path.join(BASE_PATH, imagePath);

  // Extract activity name from path
  const activityName = path.basename(imagePath, '.png').replace(/_/g, ' ').replace('type ', '');

  const iconPrompt = `Simple flat design icon illustration for a ${activityName} activity. Minimal cartoon style showing sports equipment and abstract figures. Bright cheerful colors on light background. App icon style, no realistic human features, focus on activity symbols and equipment. Family-friendly, suitable for education app.`;

  try {
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: iconPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const imageUrl = response.data[0].url || response.data[0].b64_json;

    if (response.data[0].b64_json) {
      const buffer = Buffer.from(response.data[0].b64_json, 'base64');
      fs.writeFileSync(fullPath, buffer);
    } else if (imageUrl) {
      const fetch = (await import('node-fetch')).default;
      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.buffer();
      fs.writeFileSync(fullPath, buffer);
    }

    console.log(`   ✅ Icon style saved!`);
    return true;
  } catch (error) {
    console.log(`   ❌ Icon style also failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Retrying Failed Images with Safe Prompts');
  console.log('=========================================');
  console.log(`Images to retry: ${RETRY_IMAGES.length}\n`);

  let success = 0;
  let failed = 0;

  for (const image of RETRY_IMAGES) {
    const result = await generateImage(image.path, image.prompt);
    if (result) {
      success++;
    } else {
      failed++;
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=========================================');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
