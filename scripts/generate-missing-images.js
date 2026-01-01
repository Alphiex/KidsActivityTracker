#!/usr/bin/env node

/**
 * Generate Missing Activity Images for KidsActivityTracker
 *
 * This script generates only the missing images using OpenAI DALL-E 3.
 * Prompts are simplified to avoid safety filter rejections.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

const BASE_PATH = path.join(__dirname, '..', 'src', 'assets', 'images', 'activities');

// Prompt suffix for natural, candid photography (research-based approach)
// Key: Avoid "photorealistic" - use camera metadata instead
const PROMPT_SUFFIX = `

Candid analog photo, 35mm film, Kodak Portra 400. Taken with Nikon D850, 50mm f/1.8 lens, ISO 400. Natural indoor lighting with soft shadows. Slight film grain visible. Imperfect framing like a real snapshot. Warm natural skin tones, muted colors not saturated. Background slightly out of focus. NOT glossy, NOT HDR, NOT perfect. Real authentic moment. Family-friendly wholesome content.`;

// All missing images with simplified, safety-filter-friendly prompts
const missingImages = [
  // ===== ACTIVITY TYPE IMAGES (Main category icons) =====
  // These represent the overall category

  // Swimming & Aquatics - TYPE
  { category: 'swimming_aquatics', name: 'type_swimming_aquatics',
    prompt: `Candid photo of happy children at a swimming pool, wearing swim goggles and colorful swimsuits, splashing and laughing in clear blue water. Indoor pool with bright lighting. Fun recreational swimming class atmosphere.${PROMPT_SUFFIX}` },

  // Team Sports - TYPE
  { category: 'team_sports', name: 'type_team_sports',
    prompt: `Candid photo of diverse group of kids in colorful sports jerseys playing together on a grass field. Soccer ball, sports equipment visible. Sunny day, teamwork and friendship. Youth recreational sports.${PROMPT_SUFFIX}` },

  // Individual Sports - TYPE
  { category: 'individual_sports', name: 'type_individual_sports',
    prompt: `Candid photo of a confident child athlete on a running track, ready to race. Athletic wear, stadium setting. Determination and excitement for individual achievement in youth sports.${PROMPT_SUFFIX}` },

  // Racquet Sports - TYPE
  { category: 'racquet_sports', name: 'type_racquet_sports',
    prompt: `Candid photo of kids playing tennis on an outdoor court, holding racquets and smiling. Sunny day, colorful athletic wear. Fun recreational racquet sports for children.${PROMPT_SUFFIX}` },

  // Martial Arts - TYPE
  { category: 'martial_arts', name: 'type_martial_arts',
    prompt: `Candid photo of children in white martial arts uniforms bowing respectfully in a dojo. Various colored belts, wooden floor. Discipline, respect, and fun in youth martial arts class.${PROMPT_SUFFIX}` },

  // Dance - TYPE
  { category: 'dance', name: 'type_dance',
    prompt: `Candid photo of joyful children dancing in a bright dance studio with mirrors. Colorful dance outfits, big smiles, movement and energy. Fun kids dance class atmosphere.${PROMPT_SUFFIX}` },

  // Visual Arts - TYPE
  { category: 'visual_arts', name: 'type_visual_arts',
    prompt: `Candid photo of children painting at easels in a bright art studio. Colorful paints, art smocks, creative projects. Happy kids enjoying art class, hands-on creativity.${PROMPT_SUFFIX}` },

  // Music - TYPE
  { category: 'music', name: 'type_music',
    prompt: `Candid photo of children playing musical instruments together in a music classroom. Recorders, xylophones, drums. Joyful music-making, learning rhythm and melody.${PROMPT_SUFFIX}` },

  // Performing Arts - TYPE
  { category: 'performing_arts', name: 'type_performing_arts',
    prompt: `Candid photo of children performing on a theater stage in colorful costumes. Stage lights, dramatic poses, audience visible. Youth theater performance, creativity and confidence.${PROMPT_SUFFIX}` },

  // Skating & Wheels - TYPE
  { category: 'skating_wheels', name: 'type_skating_wheels',
    prompt: `Candid photo of kids roller skating at an indoor rink with colorful lights. Safety gear, big smiles, friends skating together. Fun recreational skating activity.${PROMPT_SUFFIX}` },

  // Gymnastics & Movement - TYPE
  { category: 'gymnastics_movement', name: 'type_gymnastics_movement',
    prompt: `Candid photo of children in a gymnastics facility doing fun stretches and movements on colorful mats. Gymnastics leotards, foam pit visible. Joyful movement and flexibility training.${PROMPT_SUFFIX}` },

  // Camps - TYPE
  { category: 'camps', name: 'type_camps',
    prompt: `Candid photo of happy children at summer camp, gathered outdoors with camp counselor. Camp t-shirts, trees in background, sunny day. Friendship and outdoor fun at kids camp.${PROMPT_SUFFIX}` },

  // STEM & Education - TYPE
  { category: 'stem_education', name: 'type_stem_education',
    prompt: `Candid photo of children building with robotics kits in a bright classroom. LEGO pieces, laptops, curious expressions. Hands-on STEM learning and problem-solving.${PROMPT_SUFFIX}` },

  // Fitness & Wellness - TYPE
  { category: 'fitness_wellness', name: 'type_fitness_wellness',
    prompt: `Candid photo of children doing yoga poses on colorful mats in a bright studio. Tree pose, peaceful expressions. Kids fitness and wellness class, healthy movement.${PROMPT_SUFFIX}` },

  // Outdoor & Adventure - TYPE
  { category: 'outdoor_adventure', name: 'type_outdoor_adventure',
    prompt: `Candid photo of children hiking on a nature trail with backpacks. Forest path, pointing at nature discoveries. Outdoor adventure and exploration for kids.${PROMPT_SUFFIX}` },

  // Culinary Arts - TYPE
  { category: 'culinary_arts', name: 'type_culinary_arts',
    prompt: `Candid photo of children in chef hats cooking together in a kitchen classroom. Mixing bowls, ingredients, aprons. Fun kids cooking class, learning culinary skills.${PROMPT_SUFFIX}` },

  // Language & Culture - TYPE
  { category: 'language_culture', name: 'type_language_culture',
    prompt: `Candid photo of diverse children in a language classroom with flashcards and posters. Engaged learning, cultural flags visible. Fun language learning for kids.${PROMPT_SUFFIX}` },

  // Special Needs Programs - TYPE
  { category: 'special_needs', name: 'type_special_needs',
    prompt: `Candid photo of diverse children of all abilities playing together at a recreation center. Inclusive activities, supportive environment. Adaptive sports and inclusive fun.${PROMPT_SUFFIX}` },

  // Multi-Sport - TYPE
  { category: 'multi_sport', name: 'type_multi_sport',
    prompt: `Candid photo of children trying different sports activities at a multi-sport camp. Various equipment - balls, cones, nets. Exploring different sports, active fun.${PROMPT_SUFFIX}` },

  // Life Skills & Leadership - TYPE
  { category: 'life_skills', name: 'type_life_skills',
    prompt: `Candid photo of children in a classroom learning first aid with bandages. Educational materials, engaged learning. Youth life skills training.${PROMPT_SUFFIX}` },

  // Early Development - TYPE
  { category: 'early_development', name: 'type_early_development',
    prompt: `Candid photo of toddlers playing with colorful blocks and toys in a bright playroom. Soft play area, caregivers nearby. Early childhood development and learning through play.${PROMPT_SUFFIX}` },

  // Other Activity - TYPE
  { category: 'other', name: 'type_other',
    prompt: `Candid photo of a family with children playing in a sunny park. Kite flying, picnic blanket, laughter. Family fun and recreational activities for kids.${PROMPT_SUFFIX}` },

  // ===== MISSING SPECIFIC ACTIVITY IMAGES =====

  // Swimming & Aquatics - missing activities
  { category: 'swimming_aquatics', name: 'diving',
    prompt: `Candid photo of a child at a swimming pool ready to jump in from the pool edge. Swim goggles, swimsuit, indoor pool. Excited expression, fun swimming class.${PROMPT_SUFFIX}` },
  { category: 'swimming_aquatics', name: 'water_safety',
    prompt: `Candid photo of children sitting at pool edge wearing orange life vests, learning from instructor. Indoor pool, water safety class. Attentive kids learning to be safe in water.${PROMPT_SUFFIX}` },
  { category: 'swimming_aquatics', name: 'water_polo',
    prompt: `Candid photo of children playing with a ball in a swimming pool, splashing and laughing. Colorful swim caps, indoor pool. Team water sports fun for kids.${PROMPT_SUFFIX}` },
  { category: 'swimming_aquatics', name: 'synchronized_swimming',
    prompt: `Candid photo of young swimmers in matching swimsuits practicing formations in a pool. Indoor pool, synchronized movements. Artistic swimming class for children.${PROMPT_SUFFIX}` },

  // Team Sports - missing activities
  { category: 'team_sports', name: 'basketball',
    prompt: `Candid photo of children playing basketball in a gymnasium. One child shooting at hoop, teammates cheering. Colorful jerseys, indoor court. Youth basketball fun.${PROMPT_SUFFIX}` },
  { category: 'team_sports', name: 'volleyball',
    prompt: `Candid photo of kids playing volleyball in a gym, hitting ball over net. Team activity, athletic movement. Youth volleyball class, teamwork and fun.${PROMPT_SUFFIX}` },
  { category: 'team_sports', name: 'baseball',
    prompt: `Candid photo of child at bat in a youth baseball game. Batting helmet, baseball field, teammates watching. Little league baseball, outdoor sports fun.${PROMPT_SUFFIX}` },
  { category: 'team_sports', name: 'rugby',
    prompt: `Candid photo of children playing touch rugby on a grass field. Running with ball, teammates alongside. Youth rugby, outdoor team sports.${PROMPT_SUFFIX}` },

  // Individual Sports - missing activities
  { category: 'individual_sports', name: 'cycling',
    prompt: `Candid photo of children riding bicycles on a park path. Helmets, sunny day, smiling. Kids bike riding, outdoor recreation and exercise.${PROMPT_SUFFIX}` },
  { category: 'individual_sports', name: 'golf',
    prompt: `Candid photo of a child putting on a golf green. Junior golf club, focused expression. Kids golf lesson, learning the sport.${PROMPT_SUFFIX}` },
  { category: 'individual_sports', name: 'fencing',
    prompt: `Candid photo of two children in white fencing gear with masks and foils. Indoor fencing studio. Youth fencing class, athletic sport.${PROMPT_SUFFIX}` },

  // Racquet Sports - missing activities
  { category: 'racquet_sports', name: 'tennis',
    prompt: `Candid photo of a child playing tennis on an outdoor court. Tennis racquet, athletic outfit. Youth tennis lesson, learning to serve.${PROMPT_SUFFIX}` },
  { category: 'racquet_sports', name: 'badminton',
    prompt: `Candid photo of children playing badminton in a gymnasium. Racquets, shuttlecock, indoor court. Fun kids badminton game.${PROMPT_SUFFIX}` },
  { category: 'racquet_sports', name: 'table_tennis',
    prompt: `Candid photo of children playing table tennis (ping pong). Paddles, table, indoor setting. Fun recreational table tennis for kids.${PROMPT_SUFFIX}` },
  { category: 'racquet_sports', name: 'squash',
    prompt: `Candid photo of a child playing squash on an indoor court. Racquet, athletic wear. Youth squash lesson.${PROMPT_SUFFIX}` },
  { category: 'racquet_sports', name: 'pickleball',
    prompt: `Candid photo of children playing pickleball on an outdoor court. Paddles, net, sunny day. Fun youth pickleball game.${PROMPT_SUFFIX}` },

  // Martial Arts - missing activities
  { category: 'martial_arts', name: 'martial_arts',
    prompt: `Candid photo of children in white martial arts uniforms practicing together in a dojo. Various belt colors, bowing. Respectful martial arts class for kids.${PROMPT_SUFFIX}` },
  { category: 'martial_arts', name: 'judo',
    prompt: `Candid photo of children in white judo uniforms practicing on blue mats. Indoor dojo, learning falls. Youth judo class, safe training.${PROMPT_SUFFIX}` },
  { category: 'martial_arts', name: 'boxing',
    prompt: `Candid photo of a child with boxing gloves hitting a training bag in a gym. Safety gear, athletic training. Youth boxing fitness class.${PROMPT_SUFFIX}` },

  // Dance - missing activities
  { category: 'dance', name: 'dance',
    prompt: `Candid photo of children dancing freely in a bright dance studio. Mirror wall, colorful outfits. Joyful movement, kids dance class fun.${PROMPT_SUFFIX}` },
  { category: 'dance', name: 'jazz_dance',
    prompt: `Candid photo of children doing jazz dance in a studio. Colorful costumes, dynamic poses. Youth jazz dance class, theatrical fun.${PROMPT_SUFFIX}` },
  { category: 'dance', name: 'tap_dance',
    prompt: `Candid photo of children in tap shoes dancing on a wooden floor. Tap dance class, rhythm and movement. Kids learning tap dancing.${PROMPT_SUFFIX}` },
  { category: 'dance', name: 'contemporary',
    prompt: `Candid photo of children doing expressive dance movements in a bright studio. Flowing movements, artistic expression. Contemporary dance class for youth.${PROMPT_SUFFIX}` },

  // Visual Arts - missing activities
  { category: 'visual_arts', name: 'sculpture',
    prompt: `Candid photo of children sculpting with clay at a workshop table. Art studio, hands-on creativity. Kids sculpture and pottery class.${PROMPT_SUFFIX}` },

  // Music - missing activities
  { category: 'music', name: 'piano',
    prompt: `Candid photo of a child playing piano with proper posture. Sheet music, piano keys. Kids piano lesson, learning to play.${PROMPT_SUFFIX}` },
  { category: 'music', name: 'guitar',
    prompt: `Candid photo of a child playing acoustic guitar. Proper size guitar for kids. Youth guitar lesson, learning chords.${PROMPT_SUFFIX}` },
  { category: 'music', name: 'drums',
    prompt: `Candid photo of a child playing drums with drumsticks. Youth drum kit, practice room. Kids drum lesson, learning rhythm.${PROMPT_SUFFIX}` },
  { category: 'music', name: 'violin',
    prompt: `Candid photo of a child playing violin with proper form. Music stand, practice room. Youth violin lesson, classical music.${PROMPT_SUFFIX}` },
  { category: 'music', name: 'band',
    prompt: `Candid photo of children playing in a band together. Various instruments, practice space. Youth band, making music together.${PROMPT_SUFFIX}` },

  // Performing Arts - missing activities
  { category: 'performing_arts', name: 'drama',
    prompt: `Candid photo of children doing drama exercises in a theater space. Expressive poses, acting class. Youth drama and theater workshop.${PROMPT_SUFFIX}` },
  { category: 'performing_arts', name: 'musical_theatre',
    prompt: `Candid photo of children performing a musical number on stage. Colorful costumes, singing and dancing. Youth musical theater show.${PROMPT_SUFFIX}` },
  { category: 'performing_arts', name: 'improv',
    prompt: `Candid photo of children doing comedy games, laughing together. Theater space, improvisation. Youth improv comedy class.${PROMPT_SUFFIX}` },
  { category: 'performing_arts', name: 'circus',
    prompt: `Candid photo of children learning circus arts - juggling colorful balls. Circus studio, fun skills. Youth circus arts class.${PROMPT_SUFFIX}` },

  // Skating & Wheels - missing activities
  { category: 'skating_wheels', name: 'ice_skating',
    prompt: `Candid photo of children ice skating at an indoor rink. Winter clothing, ice skates. Kids ice skating lessons, gliding on ice.${PROMPT_SUFFIX}` },
  { category: 'skating_wheels', name: 'roller_skating',
    prompt: `Candid photo of children roller skating at an indoor rink. Colorful quad skates, safety pads. Fun kids roller skating.${PROMPT_SUFFIX}` },
  { category: 'skating_wheels', name: 'inline_skating',
    prompt: `Candid photo of children inline skating on a park path. Helmets, knee pads. Kids inline skating outdoors, active fun.${PROMPT_SUFFIX}` },

  // Gymnastics & Movement - missing activities
  { category: 'gymnastics_movement', name: 'gymnastics',
    prompt: `Candid photo of a child doing a gymnastics pose on a floor mat. Gymnastics leotard, gym setting. Youth gymnastics class, flexibility and strength.${PROMPT_SUFFIX}` },
  { category: 'gymnastics_movement', name: 'tumbling',
    prompt: `Candid photo of a child doing a cartwheel on gymnastics mats. Gym facility, colorful equipment. Kids tumbling class, fun movement.${PROMPT_SUFFIX}` },
  { category: 'gymnastics_movement', name: 'trampoline',
    prompt: `Candid photo of children jumping on trampolines at an indoor park. Big smiles, bouncing high. Kids trampoline fun, safe jumping.${PROMPT_SUFFIX}` },
  { category: 'gymnastics_movement', name: 'parkour',
    prompt: `Candid photo of children climbing on padded obstacles in a gym. Athletic movement, foam mats. Youth parkour and movement class.${PROMPT_SUFFIX}` },
  { category: 'gymnastics_movement', name: 'cheerleading',
    prompt: `Candid photo of youth cheerleaders with pom poms in matching uniforms. Gymnasium, team spirit. Kids cheerleading squad practice.${PROMPT_SUFFIX}` },

  // Camps - missing activities
  { category: 'camps', name: 'summer_camp',
    prompt: `Candid photo of happy children at summer camp with counselor. Camp t-shirts, outdoor setting, cabins. Summer camp friendship and fun.${PROMPT_SUFFIX}` },

  // Fitness & Wellness - missing activities
  { category: 'fitness_wellness', name: 'pilates',
    prompt: `Candid photo of children doing core exercises on mats in a studio. Athletic wear, instructor guiding. Kids pilates and fitness class.${PROMPT_SUFFIX}` },
  { category: 'fitness_wellness', name: 'gym',
    prompt: `Candid photo of children in gym class doing exercises. Jump ropes, cones, gymnasium. School gym class, active movement.${PROMPT_SUFFIX}` },

  // Outdoor & Adventure - missing activities
  { category: 'outdoor_adventure', name: 'outdoor',
    prompt: `Candid photo of children exploring nature in a meadow. Looking at flowers, magnifying glass. Outdoor nature discovery for kids.${PROMPT_SUFFIX}` },
  { category: 'outdoor_adventure', name: 'kayaking',
    prompt: `Candid photo of children kayaking on a calm lake. Life jackets, paddles, instructor nearby. Youth kayaking adventure, water safety.${PROMPT_SUFFIX}` },
  { category: 'outdoor_adventure', name: 'fishing',
    prompt: `Candid photo of children fishing from a dock on a lake. Fishing rods, peaceful setting. Kids learning to fish, outdoor activity.${PROMPT_SUFFIX}` },

  // Language & Culture - missing activities
  { category: 'language_culture', name: 'sign_language',
    prompt: `Candid photo of children learning sign language in a classroom. Hand gestures, ASL poster. Inclusive language learning for kids.${PROMPT_SUFFIX}` },

  // Special Needs - missing activities
  { category: 'special_needs', name: 'adaptive_sports',
    prompt: `Candid photo of diverse children of all abilities playing sports together. Inclusive equipment, supportive coaches. Adaptive sports for all kids.${PROMPT_SUFFIX}` },

  // Multi-Sport - missing activities
  { category: 'multi_sport', name: 'multi_sport',
    prompt: `Candid photo of children rotating through different sport stations in a gym. Various equipment, active learning. Multi-sport class for kids.${PROMPT_SUFFIX}` },

  // Life Skills - missing activities
  { category: 'life_skills', name: 'babysitting',
    prompt: `Candid photo of teenagers in a babysitting class learning first aid. CPR dummy, certification course. Youth babysitting training.${PROMPT_SUFFIX}` },
  { category: 'life_skills', name: 'first_aid',
    prompt: `Candid photo of children learning first aid with bandages. First aid kit, classroom setting. Kids first aid and safety course.${PROMPT_SUFFIX}` },

  // Other - missing activities
  { category: 'other', name: 'kids_night_out',
    prompt: `Candid photo of children at a fun evening event at a recreation center. Games, glow sticks, supervised fun. Kids night out activity.${PROMPT_SUFFIX}` },
];

async function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-image-1.5',
      prompt: prompt,
      n: 1,
      size: '1536x1024',
      quality: 'high'
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
  console.log('Generating Missing Activity Images');
  console.log('===================================\n');
  console.log(`Total images to generate: ${missingImages.length}\n`);

  let generated = 0;
  let skipped = 0;
  let failed = [];

  for (const image of missingImages) {
    const categoryPath = path.join(BASE_PATH, image.category);

    // Ensure directory exists
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }

    const imagePath = path.join(categoryPath, `${image.name}.png`);

    // Skip if exists
    if (fs.existsSync(imagePath)) {
      console.log(`⏭️  ${image.category}/${image.name}.png (exists)`);
      skipped++;
      continue;
    }

    try {
      console.log(`🎨 Generating ${image.category}/${image.name}.png...`);
      const result = await generateImage(image.prompt);

      if (result.type === 'url') {
        await downloadImage(result.data, imagePath);
      } else {
        const buffer = Buffer.from(result.data, 'base64');
        fs.writeFileSync(imagePath, buffer);
      }

      console.log(`   ✅ Saved`);
      generated++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      failed.push({ image: `${image.category}/${image.name}`, error: error.message });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n===================================');
  console.log(`Generated: ${generated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed images:');
    failed.forEach(f => console.log(`  - ${f.image}: ${f.error}`));
  }
}

main().catch(console.error);
