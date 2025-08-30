/**
 * Complete seed script for activity types and subtypes
 * This creates all activity types and subtypes in the database
 * and links them properly
 */

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Complete activity type and subtype definitions
const ACTIVITY_TYPES_WITH_SUBTYPES = [
  {
    code: 'swimming-aquatics',
    name: 'Swimming & Aquatics',
    displayOrder: 1,
    iconName: 'swim',
    subtypes: [
      { code: 'learn-to-swim', name: 'Learn to Swim', displayOrder: 1 },
      { code: 'competitive-swimming', name: 'Competitive Swimming', displayOrder: 2 },
      { code: 'diving', name: 'Diving', displayOrder: 3 },
      { code: 'water-polo', name: 'Water Polo', displayOrder: 4 },
      { code: 'synchronized-swimming', name: 'Synchronized Swimming', displayOrder: 5 },
      { code: 'aqua-fitness', name: 'Aqua Fitness', displayOrder: 6 },
      { code: 'lifeguarding', name: 'Lifeguarding', displayOrder: 7 },
      { code: 'swim-camp', name: 'Swim Camp', displayOrder: 8 },
      { code: 'other-aquatics', name: 'Other Aquatics', displayOrder: 99 }
    ]
  },
  {
    code: 'team-sports',
    name: 'Team Sports',
    displayOrder: 2,
    iconName: 'basketball',
    subtypes: [
      { code: 'basketball', name: 'Basketball', displayOrder: 1 },
      { code: 'soccer', name: 'Soccer', displayOrder: 2 },
      { code: 'volleyball', name: 'Volleyball', displayOrder: 3 },
      { code: 'baseball', name: 'Baseball', displayOrder: 4 },
      { code: 'softball', name: 'Softball', displayOrder: 5 },
      { code: 'hockey', name: 'Hockey', displayOrder: 6 },
      { code: 'floor-hockey', name: 'Floor Hockey', displayOrder: 7 },
      { code: 'football', name: 'Football', displayOrder: 8 },
      { code: 'flag-football', name: 'Flag Football', displayOrder: 9 },
      { code: 'lacrosse', name: 'Lacrosse', displayOrder: 10 },
      { code: 'rugby', name: 'Rugby', displayOrder: 11 },
      { code: 'cricket', name: 'Cricket', displayOrder: 12 },
      { code: 'ultimate-frisbee', name: 'Ultimate Frisbee', displayOrder: 13 },
      { code: 'other-team-sports', name: 'Other Team Sports', displayOrder: 99 }
    ]
  },
  {
    code: 'individual-sports',
    name: 'Individual Sports',
    displayOrder: 3,
    iconName: 'running',
    subtypes: [
      { code: 'track-field', name: 'Track & Field', displayOrder: 1 },
      { code: 'running', name: 'Running', displayOrder: 2 },
      { code: 'cycling', name: 'Cycling', displayOrder: 3 },
      { code: 'golf', name: 'Golf', displayOrder: 4 },
      { code: 'bowling', name: 'Bowling', displayOrder: 5 },
      { code: 'archery', name: 'Archery', displayOrder: 6 },
      { code: 'fencing', name: 'Fencing', displayOrder: 7 },
      { code: 'rock-climbing', name: 'Rock Climbing', displayOrder: 8 },
      { code: 'cross-country', name: 'Cross Country', displayOrder: 9 },
      { code: 'triathlon', name: 'Triathlon', displayOrder: 10 },
      { code: 'other-individual-sports', name: 'Other Individual Sports', displayOrder: 99 }
    ]
  },
  {
    code: 'racquet-sports',
    name: 'Racquet Sports',
    displayOrder: 4,
    iconName: 'tennis',
    subtypes: [
      { code: 'tennis', name: 'Tennis', displayOrder: 1 },
      { code: 'badminton', name: 'Badminton', displayOrder: 2 },
      { code: 'squash', name: 'Squash', displayOrder: 3 },
      { code: 'racquetball', name: 'Racquetball', displayOrder: 4 },
      { code: 'pickleball', name: 'Pickleball', displayOrder: 5 },
      { code: 'table-tennis', name: 'Table Tennis', displayOrder: 6 },
      { code: 'other-racquet-sports', name: 'Other Racquet Sports', displayOrder: 99 }
    ]
  },
  {
    code: 'martial-arts',
    name: 'Martial Arts',
    displayOrder: 5,
    iconName: 'martial-arts',
    subtypes: [
      { code: 'karate', name: 'Karate', displayOrder: 1 },
      { code: 'taekwondo', name: 'Taekwondo', displayOrder: 2 },
      { code: 'judo', name: 'Judo', displayOrder: 3 },
      { code: 'jiu-jitsu', name: 'Jiu-Jitsu', displayOrder: 4 },
      { code: 'kung-fu', name: 'Kung Fu', displayOrder: 5 },
      { code: 'aikido', name: 'Aikido', displayOrder: 6 },
      { code: 'boxing', name: 'Boxing', displayOrder: 7 },
      { code: 'kickboxing', name: 'Kickboxing', displayOrder: 8 },
      { code: 'mma', name: 'Mixed Martial Arts', displayOrder: 9 },
      { code: 'self-defense', name: 'Self Defense', displayOrder: 10 },
      { code: 'other-martial-arts', name: 'Other Martial Arts', displayOrder: 99 }
    ]
  },
  {
    code: 'dance',
    name: 'Dance',
    displayOrder: 6,
    iconName: 'dance',
    subtypes: [
      { code: 'ballet', name: 'Ballet', displayOrder: 1 },
      { code: 'jazz', name: 'Jazz', displayOrder: 2 },
      { code: 'tap', name: 'Tap', displayOrder: 3 },
      { code: 'hip-hop', name: 'Hip Hop', displayOrder: 4 },
      { code: 'contemporary', name: 'Contemporary', displayOrder: 5 },
      { code: 'modern', name: 'Modern', displayOrder: 6 },
      { code: 'ballroom', name: 'Ballroom', displayOrder: 7 },
      { code: 'latin', name: 'Latin', displayOrder: 8 },
      { code: 'salsa', name: 'Salsa', displayOrder: 9 },
      { code: 'bollywood', name: 'Bollywood', displayOrder: 10 },
      { code: 'irish', name: 'Irish', displayOrder: 11 },
      { code: 'african', name: 'African', displayOrder: 12 },
      { code: 'breakdancing', name: 'Breakdancing', displayOrder: 13 },
      { code: 'creative-movement', name: 'Creative Movement', displayOrder: 14 },
      { code: 'other-dance', name: 'Other Dance', displayOrder: 99 }
    ]
  },
  {
    code: 'visual-arts',
    name: 'Visual Arts',
    displayOrder: 7,
    iconName: 'palette',
    subtypes: [
      { code: 'painting', name: 'Painting', displayOrder: 1 },
      { code: 'drawing', name: 'Drawing', displayOrder: 2 },
      { code: 'sculpture', name: 'Sculpture', displayOrder: 3 },
      { code: 'pottery', name: 'Pottery', displayOrder: 4 },
      { code: 'ceramics', name: 'Ceramics', displayOrder: 5 },
      { code: 'photography', name: 'Photography', displayOrder: 6 },
      { code: 'digital-art', name: 'Digital Art', displayOrder: 7 },
      { code: 'printmaking', name: 'Printmaking', displayOrder: 8 },
      { code: 'mixed-media', name: 'Mixed Media', displayOrder: 9 },
      { code: 'crafts', name: 'Crafts', displayOrder: 10 },
      { code: 'jewelry-making', name: 'Jewelry Making', displayOrder: 11 },
      { code: 'fashion-design', name: 'Fashion Design', displayOrder: 12 },
      { code: 'other-visual-arts', name: 'Other Visual Arts', displayOrder: 99 }
    ]
  },
  {
    code: 'music',
    name: 'Music',
    displayOrder: 8,
    iconName: 'music',
    subtypes: [
      { code: 'piano', name: 'Piano', displayOrder: 1 },
      { code: 'guitar', name: 'Guitar', displayOrder: 2 },
      { code: 'violin', name: 'Violin', displayOrder: 3 },
      { code: 'drums', name: 'Drums', displayOrder: 4 },
      { code: 'voice', name: 'Voice/Singing', displayOrder: 5 },
      { code: 'band', name: 'Band', displayOrder: 6 },
      { code: 'orchestra', name: 'Orchestra', displayOrder: 7 },
      { code: 'choir', name: 'Choir', displayOrder: 8 },
      { code: 'ukulele', name: 'Ukulele', displayOrder: 9 },
      { code: 'brass', name: 'Brass Instruments', displayOrder: 10 },
      { code: 'woodwind', name: 'Woodwind Instruments', displayOrder: 11 },
      { code: 'music-theory', name: 'Music Theory', displayOrder: 12 },
      { code: 'music-production', name: 'Music Production', displayOrder: 13 },
      { code: 'other-music', name: 'Other Music', displayOrder: 99 }
    ]
  },
  {
    code: 'performing-arts',
    name: 'Performing Arts',
    displayOrder: 9,
    iconName: 'theater',
    subtypes: [
      { code: 'drama', name: 'Drama', displayOrder: 1 },
      { code: 'musical-theatre', name: 'Musical Theatre', displayOrder: 2 },
      { code: 'acting', name: 'Acting', displayOrder: 3 },
      { code: 'improv', name: 'Improv', displayOrder: 4 },
      { code: 'comedy', name: 'Comedy', displayOrder: 5 },
      { code: 'circus-arts', name: 'Circus Arts', displayOrder: 6 },
      { code: 'magic', name: 'Magic', displayOrder: 7 },
      { code: 'puppetry', name: 'Puppetry', displayOrder: 8 },
      { code: 'film-making', name: 'Film Making', displayOrder: 9 },
      { code: 'other-performing-arts', name: 'Other Performing Arts', displayOrder: 99 }
    ]
  },
  {
    code: 'skating-wheels',
    name: 'Skating & Wheels',
    displayOrder: 10,
    iconName: 'skating',
    subtypes: [
      { code: 'ice-skating', name: 'Ice Skating', displayOrder: 1 },
      { code: 'figure-skating', name: 'Figure Skating', displayOrder: 2 },
      { code: 'speed-skating', name: 'Speed Skating', displayOrder: 3 },
      { code: 'roller-skating', name: 'Roller Skating', displayOrder: 4 },
      { code: 'inline-skating', name: 'Inline Skating', displayOrder: 5 },
      { code: 'skateboarding', name: 'Skateboarding', displayOrder: 6 },
      { code: 'scootering', name: 'Scootering', displayOrder: 7 },
      { code: 'bmx', name: 'BMX', displayOrder: 8 },
      { code: 'other-skating', name: 'Other Skating', displayOrder: 99 }
    ]
  },
  {
    code: 'gymnastics-movement',
    name: 'Gymnastics & Movement',
    displayOrder: 11,
    iconName: 'gymnastics',
    subtypes: [
      { code: 'artistic-gymnastics', name: 'Artistic Gymnastics', displayOrder: 1 },
      { code: 'rhythmic-gymnastics', name: 'Rhythmic Gymnastics', displayOrder: 2 },
      { code: 'trampoline', name: 'Trampoline', displayOrder: 3 },
      { code: 'tumbling', name: 'Tumbling', displayOrder: 4 },
      { code: 'acrobatics', name: 'Acrobatics', displayOrder: 5 },
      { code: 'parkour', name: 'Parkour', displayOrder: 6 },
      { code: 'ninja-training', name: 'Ninja Training', displayOrder: 7 },
      { code: 'cheerleading', name: 'Cheerleading', displayOrder: 8 },
      { code: 'other-gymnastics', name: 'Other Gymnastics', displayOrder: 99 }
    ]
  },
  {
    code: 'camps',
    name: 'Camps',
    displayOrder: 12,
    iconName: 'camp',
    subtypes: [
      { code: 'day-camp', name: 'Day Camp', displayOrder: 1 },
      { code: 'sports-camp', name: 'Sports Camp', displayOrder: 2 },
      { code: 'arts-camp', name: 'Arts Camp', displayOrder: 3 },
      { code: 'science-camp', name: 'Science Camp', displayOrder: 4 },
      { code: 'tech-camp', name: 'Tech Camp', displayOrder: 5 },
      { code: 'outdoor-camp', name: 'Outdoor Camp', displayOrder: 6 },
      { code: 'adventure-camp', name: 'Adventure Camp', displayOrder: 7 },
      { code: 'leadership-camp', name: 'Leadership Camp', displayOrder: 8 },
      { code: 'specialty-camp', name: 'Specialty Camp', displayOrder: 9 },
      { code: 'march-break-camp', name: 'March Break Camp', displayOrder: 10 },
      { code: 'winter-camp', name: 'Winter Camp', displayOrder: 11 },
      { code: 'summer-camp', name: 'Summer Camp', displayOrder: 12 },
      { code: 'other-camp', name: 'Other Camp', displayOrder: 99 }
    ]
  },
  {
    code: 'stem-education',
    name: 'STEM & Education',
    displayOrder: 13,
    iconName: 'science',
    subtypes: [
      { code: 'robotics', name: 'Robotics', displayOrder: 1 },
      { code: 'coding', name: 'Coding', displayOrder: 2 },
      { code: 'science', name: 'Science', displayOrder: 3 },
      { code: 'chemistry', name: 'Chemistry', displayOrder: 4 },
      { code: 'physics', name: 'Physics', displayOrder: 5 },
      { code: 'biology', name: 'Biology', displayOrder: 6 },
      { code: 'engineering', name: 'Engineering', displayOrder: 7 },
      { code: 'mathematics', name: 'Mathematics', displayOrder: 8 },
      { code: 'computer-science', name: 'Computer Science', displayOrder: 9 },
      { code: 'electronics', name: 'Electronics', displayOrder: 10 },
      { code: 'game-development', name: 'Game Development', displayOrder: 11 },
      { code: 'minecraft', name: 'Minecraft', displayOrder: 12 },
      { code: 'lego', name: 'LEGO', displayOrder: 13 },
      { code: 'other-stem', name: 'Other STEM', displayOrder: 99 }
    ]
  },
  {
    code: 'fitness-wellness',
    name: 'Fitness & Wellness',
    displayOrder: 14,
    iconName: 'fitness',
    subtypes: [
      { code: 'yoga', name: 'Yoga', displayOrder: 1 },
      { code: 'pilates', name: 'Pilates', displayOrder: 2 },
      { code: 'fitness-training', name: 'Fitness Training', displayOrder: 3 },
      { code: 'strength-training', name: 'Strength Training', displayOrder: 4 },
      { code: 'cardio', name: 'Cardio', displayOrder: 5 },
      { code: 'zumba', name: 'Zumba', displayOrder: 6 },
      { code: 'aerobics', name: 'Aerobics', displayOrder: 7 },
      { code: 'mindfulness', name: 'Mindfulness', displayOrder: 8 },
      { code: 'meditation', name: 'Meditation', displayOrder: 9 },
      { code: 'crossfit-kids', name: 'CrossFit Kids', displayOrder: 10 },
      { code: 'other-fitness', name: 'Other Fitness', displayOrder: 99 }
    ]
  },
  {
    code: 'outdoor-adventure',
    name: 'Outdoor & Adventure',
    displayOrder: 15,
    iconName: 'outdoor',
    subtypes: [
      { code: 'hiking', name: 'Hiking', displayOrder: 1 },
      { code: 'camping', name: 'Camping', displayOrder: 2 },
      { code: 'kayaking', name: 'Kayaking', displayOrder: 3 },
      { code: 'canoeing', name: 'Canoeing', displayOrder: 4 },
      { code: 'sailing', name: 'Sailing', displayOrder: 5 },
      { code: 'fishing', name: 'Fishing', displayOrder: 6 },
      { code: 'nature-exploration', name: 'Nature Exploration', displayOrder: 7 },
      { code: 'orienteering', name: 'Orienteering', displayOrder: 8 },
      { code: 'survival-skills', name: 'Survival Skills', displayOrder: 9 },
      { code: 'bird-watching', name: 'Bird Watching', displayOrder: 10 },
      { code: 'gardening', name: 'Gardening', displayOrder: 11 },
      { code: 'other-outdoor', name: 'Other Outdoor', displayOrder: 99 }
    ]
  },
  {
    code: 'culinary-arts',
    name: 'Culinary Arts',
    displayOrder: 16,
    iconName: 'cooking',
    subtypes: [
      { code: 'cooking', name: 'Cooking', displayOrder: 1 },
      { code: 'baking', name: 'Baking', displayOrder: 2 },
      { code: 'pastry', name: 'Pastry', displayOrder: 3 },
      { code: 'international-cuisine', name: 'International Cuisine', displayOrder: 4 },
      { code: 'healthy-cooking', name: 'Healthy Cooking', displayOrder: 5 },
      { code: 'cake-decorating', name: 'Cake Decorating', displayOrder: 6 },
      { code: 'nutrition', name: 'Nutrition', displayOrder: 7 },
      { code: 'other-culinary', name: 'Other Culinary', displayOrder: 99 }
    ]
  },
  {
    code: 'language-culture',
    name: 'Language & Culture',
    displayOrder: 17,
    iconName: 'language',
    subtypes: [
      { code: 'french', name: 'French', displayOrder: 1 },
      { code: 'spanish', name: 'Spanish', displayOrder: 2 },
      { code: 'mandarin', name: 'Mandarin', displayOrder: 3 },
      { code: 'english', name: 'English', displayOrder: 4 },
      { code: 'german', name: 'German', displayOrder: 5 },
      { code: 'italian', name: 'Italian', displayOrder: 6 },
      { code: 'japanese', name: 'Japanese', displayOrder: 7 },
      { code: 'korean', name: 'Korean', displayOrder: 8 },
      { code: 'arabic', name: 'Arabic', displayOrder: 9 },
      { code: 'sign-language', name: 'Sign Language', displayOrder: 10 },
      { code: 'cultural-studies', name: 'Cultural Studies', displayOrder: 11 },
      { code: 'other-language', name: 'Other Language', displayOrder: 99 }
    ]
  },
  {
    code: 'special-needs',
    name: 'Special Needs Programs',
    displayOrder: 18,
    iconName: 'accessibility',
    subtypes: [
      { code: 'adaptive-sports', name: 'Adaptive Sports', displayOrder: 1 },
      { code: 'therapeutic-programs', name: 'Therapeutic Programs', displayOrder: 2 },
      { code: 'sensory-programs', name: 'Sensory Programs', displayOrder: 3 },
      { code: 'social-skills', name: 'Social Skills', displayOrder: 4 },
      { code: 'inclusive-programs', name: 'Inclusive Programs', displayOrder: 5 },
      { code: 'other-special-needs', name: 'Other Special Needs', displayOrder: 99 }
    ]
  },
  {
    code: 'multi-sport',
    name: 'Multi-Sport',
    displayOrder: 19,
    iconName: 'sports',
    subtypes: [
      { code: 'sport-sampler', name: 'Sport Sampler', displayOrder: 1 },
      { code: 'fundamentals', name: 'Fundamentals', displayOrder: 2 },
      { code: 'active-start', name: 'Active Start', displayOrder: 3 },
      { code: 'sport-mix', name: 'Sport Mix', displayOrder: 4 },
      { code: 'other-multi-sport', name: 'Other Multi-Sport', displayOrder: 99 }
    ]
  },
  {
    code: 'life-skills-leadership',
    name: 'Life Skills & Leadership',
    displayOrder: 20,
    iconName: 'leadership',
    subtypes: [
      { code: 'leadership', name: 'Leadership', displayOrder: 1 },
      { code: 'public-speaking', name: 'Public Speaking', displayOrder: 2 },
      { code: 'debate', name: 'Debate', displayOrder: 3 },
      { code: 'entrepreneurship', name: 'Entrepreneurship', displayOrder: 4 },
      { code: 'financial-literacy', name: 'Financial Literacy', displayOrder: 5 },
      { code: 'first-aid', name: 'First Aid', displayOrder: 6 },
      { code: 'babysitting', name: 'Babysitting', displayOrder: 7 },
      { code: 'volunteer-programs', name: 'Volunteer Programs', displayOrder: 8 },
      { code: 'other-life-skills', name: 'Other Life Skills', displayOrder: 99 }
    ]
  },
  {
    code: 'early-development',
    name: 'Early Development',
    displayOrder: 21,
    iconName: 'baby',
    subtypes: [
      { code: 'parent-tot', name: 'Parent & Tot', displayOrder: 1 },
      { code: 'preschool-programs', name: 'Preschool Programs', displayOrder: 2 },
      { code: 'kindergym', name: 'Kindergym', displayOrder: 3 },
      { code: 'sensory-play', name: 'Sensory Play', displayOrder: 4 },
      { code: 'music-movement', name: 'Music & Movement', displayOrder: 5 },
      { code: 'story-time', name: 'Story Time', displayOrder: 6 },
      { code: 'other-early-development', name: 'Other Early Development', displayOrder: 99 }
    ]
  },
  {
    code: 'other-activity',
    name: 'Other Activity',
    displayOrder: 99,
    iconName: 'other',
    subtypes: [
      { code: 'other', name: 'Other', displayOrder: 1 },
      { code: 'miscellaneous', name: 'Miscellaneous', displayOrder: 2 }
    ]
  }
];

async function seedActivityTypes() {
  try {
    console.log('Starting activity type and subtype seeding...\n');

    for (const typeData of ACTIVITY_TYPES_WITH_SUBTYPES) {
      console.log(`Processing ${typeData.name}...`);
      
      // Create or update the activity type
      const activityType = await prisma.activityType.upsert({
        where: { code: typeData.code },
        update: {
          name: typeData.name,
          displayOrder: typeData.displayOrder,
          iconName: typeData.iconName
        },
        create: {
          code: typeData.code,
          name: typeData.name,
          displayOrder: typeData.displayOrder,
          iconName: typeData.iconName
        }
      });
      
      console.log(`  ✓ Created/Updated activity type: ${activityType.name}`);
      
      // Create or update subtypes
      for (const subtypeData of typeData.subtypes) {
        await prisma.activitySubtype.upsert({
          where: {
            activityTypeId_code: {
              activityTypeId: activityType.id,
              code: subtypeData.code
            }
          },
          update: {
            name: subtypeData.name,
            displayOrder: subtypeData.displayOrder
          },
          create: {
            activityTypeId: activityType.id,
            code: subtypeData.code,
            name: subtypeData.name,
            displayOrder: subtypeData.displayOrder
          }
        });
      }
      
      console.log(`  ✓ Created/Updated ${typeData.subtypes.length} subtypes`);
    }
    
    console.log('\n✅ Activity types and subtypes seeded successfully!');
    
    // Print summary
    const typeCount = await prisma.activityType.count();
    const subtypeCount = await prisma.activitySubtype.count();
    
    console.log(`\nSummary:`);
    console.log(`  - Total activity types: ${typeCount}`);
    console.log(`  - Total activity subtypes: ${subtypeCount}`);
    
  } catch (error) {
    console.error('Error seeding activity types:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedActivityTypes();