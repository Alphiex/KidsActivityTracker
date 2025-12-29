const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting enhanced activity types seed...');

  // Create Activity Types
  console.log('🏷️ Creating activity types...');
  const activityTypes = [
    { code: 'swimming-aquatics', name: 'Swimming & Aquatics', displayOrder: 1 },
    { code: 'team-sports', name: 'Team Sports', displayOrder: 2 },
    { code: 'individual-sports', name: 'Individual Sports', displayOrder: 3 },
    { code: 'racquet-sports', name: 'Racquet Sports', displayOrder: 4 },
    { code: 'martial-arts', name: 'Martial Arts', displayOrder: 5 },
    { code: 'dance', name: 'Dance', displayOrder: 6 },
    { code: 'visual-arts', name: 'Visual Arts', displayOrder: 7 },
    { code: 'music', name: 'Music', displayOrder: 8 },
    { code: 'performing-arts', name: 'Performing Arts', displayOrder: 9 },
    { code: 'skating-wheels', name: 'Skating & Wheels', displayOrder: 10 },
    { code: 'gymnastics-movement', name: 'Gymnastics & Movement', displayOrder: 11 },
    { code: 'camps', name: 'Camps', displayOrder: 12 },
    { code: 'stem-education', name: 'STEM & Education', displayOrder: 13 },
    { code: 'fitness-wellness', name: 'Fitness & Wellness', displayOrder: 14 },
    { code: 'outdoor-adventure', name: 'Outdoor & Adventure', displayOrder: 15 },
    { code: 'culinary-arts', name: 'Culinary Arts', displayOrder: 16 },
    { code: 'language-culture', name: 'Language & Culture', displayOrder: 17 },
    { code: 'special-needs-programs', name: 'Special Needs Programs', displayOrder: 18 },
    { code: 'multi-sport', name: 'Multi-Sport', displayOrder: 19 },
    { code: 'life-skills-leadership', name: 'Life Skills & Leadership', displayOrder: 20 },
    { code: 'early-development', name: 'Early Development', displayOrder: 21 },
    { code: 'other-activity', name: 'Other Activity', displayOrder: 22 }
  ];

  for (const activityType of activityTypes) {
    const created = await prisma.activityType.upsert({
      where: { code: activityType.code },
      update: { name: activityType.name, displayOrder: activityType.displayOrder },
      create: activityType
    });
    console.log(`✅ Created activity type: ${created.name}`);
  }

  // Create Activity Subtypes
  console.log('🏷️ Creating comprehensive activity subtypes...');
  
  // Get the created activity types for reference
  const types = await prisma.activityType.findMany();
  const typeMap = {};
  types.forEach(type => {
    typeMap[type.code] = type.id;
  });

  const activitySubtypes = [
    // Swimming & Aquatics - Enhanced with more specific programs
    { code: 'learn-to-swim', name: 'Learn to Swim', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 1 },
    { code: 'competitive-swimming', name: 'Competitive Swimming', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 2 },
    { code: 'diving', name: 'Diving', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 3 },
    { code: 'water-polo', name: 'Water Polo', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 4 },
    { code: 'synchronized-swimming', name: 'Synchronized Swimming', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 5 },
    { code: 'aqua-fitness', name: 'Aqua Fitness', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 6 },
    { code: 'lifeguarding', name: 'Lifeguarding', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 7 },
    { code: 'swim-camp', name: 'Swim Camp', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 8 },
    { code: 'other-aquatics', name: 'Other Aquatics', activityTypeId: typeMap['swimming-aquatics'], displayOrder: 99 },
    
    // Team Sports - Enhanced with more sports
    { code: 'basketball', name: 'Basketball', activityTypeId: typeMap['team-sports'], displayOrder: 1 },
    { code: 'soccer', name: 'Soccer', activityTypeId: typeMap['team-sports'], displayOrder: 2 },
    { code: 'volleyball', name: 'Volleyball', activityTypeId: typeMap['team-sports'], displayOrder: 3 },
    { code: 'baseball', name: 'Baseball', activityTypeId: typeMap['team-sports'], displayOrder: 4 },
    { code: 'softball', name: 'Softball', activityTypeId: typeMap['team-sports'], displayOrder: 5 },
    { code: 'hockey', name: 'Hockey', activityTypeId: typeMap['team-sports'], displayOrder: 6 },
    { code: 'floor-hockey', name: 'Floor Hockey', activityTypeId: typeMap['team-sports'], displayOrder: 7 },
    { code: 'football', name: 'Football', activityTypeId: typeMap['team-sports'], displayOrder: 8 },
    { code: 'flag-football', name: 'Flag Football', activityTypeId: typeMap['team-sports'], displayOrder: 9 },
    { code: 'lacrosse', name: 'Lacrosse', activityTypeId: typeMap['team-sports'], displayOrder: 10 },
    { code: 'rugby', name: 'Rugby', activityTypeId: typeMap['team-sports'], displayOrder: 11 },
    { code: 'cricket', name: 'Cricket', activityTypeId: typeMap['team-sports'], displayOrder: 12 },
    { code: 'ultimate-frisbee', name: 'Ultimate Frisbee', activityTypeId: typeMap['team-sports'], displayOrder: 13 },
    { code: 'other-team-sports', name: 'Other Team Sports', activityTypeId: typeMap['team-sports'], displayOrder: 99 },
    
    // Individual Sports - NEW comprehensive list based on research
    { code: 'track-field', name: 'Track & Field', activityTypeId: typeMap['individual-sports'], displayOrder: 1 },
    { code: 'running', name: 'Running', activityTypeId: typeMap['individual-sports'], displayOrder: 2 },
    { code: 'cycling', name: 'Cycling', activityTypeId: typeMap['individual-sports'], displayOrder: 3 },
    { code: 'golf', name: 'Golf', activityTypeId: typeMap['individual-sports'], displayOrder: 4 },
    { code: 'bowling', name: 'Bowling', activityTypeId: typeMap['individual-sports'], displayOrder: 5 },
    { code: 'archery', name: 'Archery', activityTypeId: typeMap['individual-sports'], displayOrder: 6 },
    { code: 'fencing', name: 'Fencing', activityTypeId: typeMap['individual-sports'], displayOrder: 7 },
    { code: 'rock-climbing', name: 'Rock Climbing', activityTypeId: typeMap['individual-sports'], displayOrder: 8 },
    { code: 'cross-country', name: 'Cross Country', activityTypeId: typeMap['individual-sports'], displayOrder: 9 },
    { code: 'triathlon', name: 'Triathlon', activityTypeId: typeMap['individual-sports'], displayOrder: 10 },
    { code: 'other-individual-sports', name: 'Other Individual Sports', activityTypeId: typeMap['individual-sports'], displayOrder: 99 },
    
    // Racquet Sports - Enhanced from existing
    { code: 'tennis', name: 'Tennis', activityTypeId: typeMap['racquet-sports'], displayOrder: 1 },
    { code: 'badminton', name: 'Badminton', activityTypeId: typeMap['racquet-sports'], displayOrder: 2 },
    { code: 'squash', name: 'Squash', activityTypeId: typeMap['racquet-sports'], displayOrder: 3 },
    { code: 'racquetball', name: 'Racquetball', activityTypeId: typeMap['racquet-sports'], displayOrder: 4 },
    { code: 'pickleball', name: 'Pickleball', activityTypeId: typeMap['racquet-sports'], displayOrder: 5 },
    { code: 'table-tennis', name: 'Table Tennis', activityTypeId: typeMap['racquet-sports'], displayOrder: 6 },
    { code: 'other-racquet-sports', name: 'Other Racquet Sports', activityTypeId: typeMap['racquet-sports'], displayOrder: 99 },
    
    // Martial Arts - Enhanced from existing
    { code: 'karate', name: 'Karate', activityTypeId: typeMap['martial-arts'], displayOrder: 1 },
    { code: 'taekwondo', name: 'Taekwondo', activityTypeId: typeMap['martial-arts'], displayOrder: 2 },
    { code: 'judo', name: 'Judo', activityTypeId: typeMap['martial-arts'], displayOrder: 3 },
    { code: 'jiu-jitsu', name: 'Jiu-Jitsu', activityTypeId: typeMap['martial-arts'], displayOrder: 4 },
    { code: 'kung-fu', name: 'Kung Fu', activityTypeId: typeMap['martial-arts'], displayOrder: 5 },
    { code: 'aikido', name: 'Aikido', activityTypeId: typeMap['martial-arts'], displayOrder: 6 },
    { code: 'boxing', name: 'Boxing', activityTypeId: typeMap['martial-arts'], displayOrder: 7 },
    { code: 'kickboxing', name: 'Kickboxing', activityTypeId: typeMap['martial-arts'], displayOrder: 8 },
    { code: 'mma', name: 'Mixed Martial Arts', activityTypeId: typeMap['martial-arts'], displayOrder: 9 },
    { code: 'self-defense', name: 'Self Defense', activityTypeId: typeMap['martial-arts'], displayOrder: 10 },
    { code: 'other-martial-arts', name: 'Other Martial Arts', activityTypeId: typeMap['martial-arts'], displayOrder: 99 },
    
    // Dance - Enhanced from existing
    { code: 'ballet', name: 'Ballet', activityTypeId: typeMap['dance'], displayOrder: 1 },
    { code: 'jazz', name: 'Jazz', activityTypeId: typeMap['dance'], displayOrder: 2 },
    { code: 'tap', name: 'Tap', activityTypeId: typeMap['dance'], displayOrder: 3 },
    { code: 'hip-hop', name: 'Hip Hop', activityTypeId: typeMap['dance'], displayOrder: 4 },
    { code: 'contemporary', name: 'Contemporary', activityTypeId: typeMap['dance'], displayOrder: 5 },
    { code: 'modern', name: 'Modern', activityTypeId: typeMap['dance'], displayOrder: 6 },
    { code: 'ballroom', name: 'Ballroom', activityTypeId: typeMap['dance'], displayOrder: 7 },
    { code: 'latin', name: 'Latin', activityTypeId: typeMap['dance'], displayOrder: 8 },
    { code: 'salsa', name: 'Salsa', activityTypeId: typeMap['dance'], displayOrder: 9 },
    { code: 'bollywood', name: 'Bollywood', activityTypeId: typeMap['dance'], displayOrder: 10 },
    { code: 'irish', name: 'Irish', activityTypeId: typeMap['dance'], displayOrder: 11 },
    { code: 'african', name: 'African', activityTypeId: typeMap['dance'], displayOrder: 12 },
    { code: 'breakdancing', name: 'Breakdancing', activityTypeId: typeMap['dance'], displayOrder: 13 },
    { code: 'creative-movement', name: 'Creative Movement', activityTypeId: typeMap['dance'], displayOrder: 14 },
    { code: 'other-dance', name: 'Other Dance', activityTypeId: typeMap['dance'], displayOrder: 99 },
    
    // Visual Arts - Enhanced from existing
    { code: 'painting', name: 'Painting', activityTypeId: typeMap['visual-arts'], displayOrder: 1 },
    { code: 'drawing', name: 'Drawing', activityTypeId: typeMap['visual-arts'], displayOrder: 2 },
    { code: 'sculpture', name: 'Sculpture', activityTypeId: typeMap['visual-arts'], displayOrder: 3 },
    { code: 'pottery', name: 'Pottery', activityTypeId: typeMap['visual-arts'], displayOrder: 4 },
    { code: 'ceramics', name: 'Ceramics', activityTypeId: typeMap['visual-arts'], displayOrder: 5 },
    { code: 'photography', name: 'Photography', activityTypeId: typeMap['visual-arts'], displayOrder: 6 },
    { code: 'digital-art', name: 'Digital Art', activityTypeId: typeMap['visual-arts'], displayOrder: 7 },
    { code: 'printmaking', name: 'Printmaking', activityTypeId: typeMap['visual-arts'], displayOrder: 8 },
    { code: 'mixed-media', name: 'Mixed Media', activityTypeId: typeMap['visual-arts'], displayOrder: 9 },
    { code: 'crafts', name: 'Crafts', activityTypeId: typeMap['visual-arts'], displayOrder: 10 },
    { code: 'jewelry-making', name: 'Jewelry Making', activityTypeId: typeMap['visual-arts'], displayOrder: 11 },
    { code: 'fashion-design', name: 'Fashion Design', activityTypeId: typeMap['visual-arts'], displayOrder: 12 },
    { code: 'other-visual-arts', name: 'Other Visual Arts', activityTypeId: typeMap['visual-arts'], displayOrder: 99 },
    
    // Music - Enhanced from existing
    { code: 'piano', name: 'Piano', activityTypeId: typeMap['music'], displayOrder: 1 },
    { code: 'guitar', name: 'Guitar', activityTypeId: typeMap['music'], displayOrder: 2 },
    { code: 'violin', name: 'Violin', activityTypeId: typeMap['music'], displayOrder: 3 },
    { code: 'drums', name: 'Drums', activityTypeId: typeMap['music'], displayOrder: 4 },
    { code: 'voice', name: 'Voice/Singing', activityTypeId: typeMap['music'], displayOrder: 5 },
    { code: 'band', name: 'Band', activityTypeId: typeMap['music'], displayOrder: 6 },
    { code: 'orchestra', name: 'Orchestra', activityTypeId: typeMap['music'], displayOrder: 7 },
    { code: 'choir', name: 'Choir', activityTypeId: typeMap['music'], displayOrder: 8 },
    { code: 'ukulele', name: 'Ukulele', activityTypeId: typeMap['music'], displayOrder: 9 },
    { code: 'brass', name: 'Brass Instruments', activityTypeId: typeMap['music'], displayOrder: 10 },
    { code: 'woodwind', name: 'Woodwind Instruments', activityTypeId: typeMap['music'], displayOrder: 11 },
    { code: 'music-theory', name: 'Music Theory', activityTypeId: typeMap['music'], displayOrder: 12 },
    { code: 'music-production', name: 'Music Production', activityTypeId: typeMap['music'], displayOrder: 13 },
    { code: 'other-music', name: 'Other Music', activityTypeId: typeMap['music'], displayOrder: 99 },
    
    // Performing Arts - Enhanced from existing
    { code: 'drama', name: 'Drama', activityTypeId: typeMap['performing-arts'], displayOrder: 1 },
    { code: 'musical-theatre', name: 'Musical Theatre', activityTypeId: typeMap['performing-arts'], displayOrder: 2 },
    { code: 'acting', name: 'Acting', activityTypeId: typeMap['performing-arts'], displayOrder: 3 },
    { code: 'improv', name: 'Improv', activityTypeId: typeMap['performing-arts'], displayOrder: 4 },
    { code: 'comedy', name: 'Comedy', activityTypeId: typeMap['performing-arts'], displayOrder: 5 },
    { code: 'circus-arts', name: 'Circus Arts', activityTypeId: typeMap['performing-arts'], displayOrder: 6 },
    { code: 'puppetry', name: 'Puppetry', activityTypeId: typeMap['performing-arts'], displayOrder: 7 },
    { code: 'storytelling', name: 'Storytelling', activityTypeId: typeMap['performing-arts'], displayOrder: 8 },
    { code: 'film-making', name: 'Film Making', activityTypeId: typeMap['performing-arts'], displayOrder: 9 },
    { code: 'other-performing-arts', name: 'Other Performing Arts', activityTypeId: typeMap['performing-arts'], displayOrder: 99 },
    
    // Skating & Wheels - NEW comprehensive list
    { code: 'ice-skating', name: 'Ice Skating', activityTypeId: typeMap['skating-wheels'], displayOrder: 1 },
    { code: 'figure-skating', name: 'Figure Skating', activityTypeId: typeMap['skating-wheels'], displayOrder: 2 },
    { code: 'roller-skating', name: 'Roller Skating', activityTypeId: typeMap['skating-wheels'], displayOrder: 3 },
    { code: 'inline-skating', name: 'Inline Skating', activityTypeId: typeMap['skating-wheels'], displayOrder: 4 },
    { code: 'skateboarding', name: 'Skateboarding', activityTypeId: typeMap['skating-wheels'], displayOrder: 5 },
    { code: 'scooter', name: 'Scooter', activityTypeId: typeMap['skating-wheels'], displayOrder: 6 },
    { code: 'cycling', name: 'Cycling', activityTypeId: typeMap['skating-wheels'], displayOrder: 7 },
    { code: 'bmx', name: 'BMX', activityTypeId: typeMap['skating-wheels'], displayOrder: 8 },
    { code: 'other-skating-wheels', name: 'Other Skating & Wheels', activityTypeId: typeMap['skating-wheels'], displayOrder: 99 },
    
    // Gymnastics & Movement - NEW comprehensive list
    { code: 'gymnastics', name: 'Gymnastics', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 1 },
    { code: 'tumbling', name: 'Tumbling', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 2 },
    { code: 'trampoline', name: 'Trampoline', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 3 },
    { code: 'parkour', name: 'Parkour', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 4 },
    { code: 'acrobatics', name: 'Acrobatics', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 5 },
    { code: 'cheerleading', name: 'Cheerleading', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 6 },
    { code: 'rhythmic-gymnastics', name: 'Rhythmic Gymnastics', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 7 },
    { code: 'other-gymnastics', name: 'Other Gymnastics & Movement', activityTypeId: typeMap['gymnastics-movement'], displayOrder: 99 },
    
    // Camps - Comprehensive list with activity-specific subtypes
    // Format-based camps
    { code: 'day-camps', name: 'Day Camps', activityTypeId: typeMap['camps'], displayOrder: 1 },
    { code: 'overnight-camps', name: 'Overnight Camps', activityTypeId: typeMap['camps'], displayOrder: 2 },

    // Activity-specific camps (mirror main activity types)
    { code: 'swimming-camps', name: 'Swimming Camps', activityTypeId: typeMap['camps'], displayOrder: 10 },
    { code: 'team-sports-camps', name: 'Team Sports Camps', activityTypeId: typeMap['camps'], displayOrder: 11 },
    { code: 'individual-sports-camps', name: 'Individual Sports Camps', activityTypeId: typeMap['camps'], displayOrder: 12 },
    { code: 'racquet-sports-camps', name: 'Racquet Sports Camps', activityTypeId: typeMap['camps'], displayOrder: 13 },
    { code: 'dance-camps', name: 'Dance Camps', activityTypeId: typeMap['camps'], displayOrder: 14 },
    { code: 'music-camps', name: 'Music Camps', activityTypeId: typeMap['camps'], displayOrder: 15 },
    { code: 'performing-arts-camps', name: 'Performing Arts Camps', activityTypeId: typeMap['camps'], displayOrder: 16 },
    { code: 'visual-arts-camps', name: 'Visual Arts Camps', activityTypeId: typeMap['camps'], displayOrder: 17 },
    { code: 'martial-arts-camps', name: 'Martial Arts Camps', activityTypeId: typeMap['camps'], displayOrder: 18 },
    { code: 'gymnastics-camps', name: 'Gymnastics Camps', activityTypeId: typeMap['camps'], displayOrder: 19 },
    { code: 'skating-camps', name: 'Skating Camps', activityTypeId: typeMap['camps'], displayOrder: 20 },
    { code: 'outdoor-adventure-camps', name: 'Outdoor Adventure Camps', activityTypeId: typeMap['camps'], displayOrder: 21 },
    { code: 'cooking-camps', name: 'Cooking Camps', activityTypeId: typeMap['camps'], displayOrder: 22 },
    { code: 'language-camps', name: 'Language Camps', activityTypeId: typeMap['camps'], displayOrder: 23 },
    { code: 'multi-activity-camps', name: 'Multi-Activity Camps', activityTypeId: typeMap['camps'], displayOrder: 24 },

    // Theme-based camps (keep existing)
    { code: 'sports-camps', name: 'Sports Camps', activityTypeId: typeMap['camps'], displayOrder: 30 },
    { code: 'arts-camps', name: 'Arts Camps', activityTypeId: typeMap['camps'], displayOrder: 31 },
    { code: 'stem-camps', name: 'STEM Camps', activityTypeId: typeMap['camps'], displayOrder: 32 },
    { code: 'adventure-camps', name: 'Adventure Camps', activityTypeId: typeMap['camps'], displayOrder: 33 },
    { code: 'specialty-camps', name: 'Specialty Camps', activityTypeId: typeMap['camps'], displayOrder: 34 },

    // Seasonal camps
    { code: 'march-break-camps', name: 'March Break Camps', activityTypeId: typeMap['camps'], displayOrder: 40 },
    { code: 'summer-camps', name: 'Summer Camps', activityTypeId: typeMap['camps'], displayOrder: 41 },
    { code: 'winter-camps', name: 'Winter Camps', activityTypeId: typeMap['camps'], displayOrder: 42 },

    // Fallback
    { code: 'other-camps', name: 'Other Camps', activityTypeId: typeMap['camps'], displayOrder: 99 },
    
    // STEM & Education - NEW comprehensive list
    { code: 'science', name: 'Science', activityTypeId: typeMap['stem-education'], displayOrder: 1 },
    { code: 'coding', name: 'Coding', activityTypeId: typeMap['stem-education'], displayOrder: 2 },
    { code: 'robotics', name: 'Robotics', activityTypeId: typeMap['stem-education'], displayOrder: 3 },
    { code: 'engineering', name: 'Engineering', activityTypeId: typeMap['stem-education'], displayOrder: 4 },
    { code: 'mathematics', name: 'Mathematics', activityTypeId: typeMap['stem-education'], displayOrder: 5 },
    { code: 'technology', name: 'Technology', activityTypeId: typeMap['stem-education'], displayOrder: 6 },
    { code: 'computer-science', name: 'Computer Science', activityTypeId: typeMap['stem-education'], displayOrder: 7 },
    { code: 'maker-space', name: 'Maker Space', activityTypeId: typeMap['stem-education'], displayOrder: 8 },
    { code: '3d-printing', name: '3D Printing', activityTypeId: typeMap['stem-education'], displayOrder: 9 },
    { code: 'other-stem', name: 'Other STEM', activityTypeId: typeMap['stem-education'], displayOrder: 99 },
    
    // Fitness & Wellness - NEW comprehensive list
    { code: 'yoga', name: 'Yoga', activityTypeId: typeMap['fitness-wellness'], displayOrder: 1 },
    { code: 'pilates', name: 'Pilates', activityTypeId: typeMap['fitness-wellness'], displayOrder: 2 },
    { code: 'zumba', name: 'Zumba', activityTypeId: typeMap['fitness-wellness'], displayOrder: 3 },
    { code: 'strength-training', name: 'Strength Training', activityTypeId: typeMap['fitness-wellness'], displayOrder: 4 },
    { code: 'cardio-fitness', name: 'Cardio Fitness', activityTypeId: typeMap['fitness-wellness'], displayOrder: 5 },
    { code: 'spinning', name: 'Spinning', activityTypeId: typeMap['fitness-wellness'], displayOrder: 6 },
    { code: 'aerobics', name: 'Aerobics', activityTypeId: typeMap['fitness-wellness'], displayOrder: 7 },
    { code: 'meditation', name: 'Meditation', activityTypeId: typeMap['fitness-wellness'], displayOrder: 8 },
    { code: 'other-fitness', name: 'Other Fitness & Wellness', activityTypeId: typeMap['fitness-wellness'], displayOrder: 99 },
    
    // Outdoor & Adventure - NEW comprehensive list
    { code: 'hiking', name: 'Hiking', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 1 },
    { code: 'rock-climbing', name: 'Rock Climbing', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 2 },
    { code: 'camping', name: 'Camping', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 3 },
    { code: 'kayaking', name: 'Kayaking', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 4 },
    { code: 'canoeing', name: 'Canoeing', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 5 },
    { code: 'fishing', name: 'Fishing', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 6 },
    { code: 'nature-exploration', name: 'Nature Exploration', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 7 },
    { code: 'survival-skills', name: 'Survival Skills', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 8 },
    { code: 'orienteering', name: 'Orienteering', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 9 },
    { code: 'other-outdoor', name: 'Other Outdoor & Adventure', activityTypeId: typeMap['outdoor-adventure'], displayOrder: 99 },
    
    // Culinary Arts - NEW comprehensive list based on research
    { code: 'cooking-classes', name: 'Cooking Classes', activityTypeId: typeMap['culinary-arts'], displayOrder: 1 },
    { code: 'baking', name: 'Baking', activityTypeId: typeMap['culinary-arts'], displayOrder: 2 },
    { code: 'pastry-arts', name: 'Pastry Arts', activityTypeId: typeMap['culinary-arts'], displayOrder: 3 },
    { code: 'knife-skills', name: 'Knife Skills', activityTypeId: typeMap['culinary-arts'], displayOrder: 4 },
    { code: 'international-cuisine', name: 'International Cuisine', activityTypeId: typeMap['culinary-arts'], displayOrder: 5 },
    { code: 'healthy-cooking', name: 'Healthy Cooking', activityTypeId: typeMap['culinary-arts'], displayOrder: 6 },
    { code: 'food-safety', name: 'Food Safety', activityTypeId: typeMap['culinary-arts'], displayOrder: 7 },
    { code: 'cake-decorating', name: 'Cake Decorating', activityTypeId: typeMap['culinary-arts'], displayOrder: 8 },
    { code: 'other-culinary', name: 'Other Culinary Arts', activityTypeId: typeMap['culinary-arts'], displayOrder: 99 },
    
    // Language & Culture - NEW comprehensive list
    { code: 'french', name: 'French', activityTypeId: typeMap['language-culture'], displayOrder: 1 },
    { code: 'spanish', name: 'Spanish', activityTypeId: typeMap['language-culture'], displayOrder: 2 },
    { code: 'mandarin', name: 'Mandarin', activityTypeId: typeMap['language-culture'], displayOrder: 3 },
    { code: 'german', name: 'German', activityTypeId: typeMap['language-culture'], displayOrder: 4 },
    { code: 'italian', name: 'Italian', activityTypeId: typeMap['language-culture'], displayOrder: 5 },
    { code: 'japanese', name: 'Japanese', activityTypeId: typeMap['language-culture'], displayOrder: 6 },
    { code: 'sign-language', name: 'Sign Language', activityTypeId: typeMap['language-culture'], displayOrder: 7 },
    { code: 'cultural-studies', name: 'Cultural Studies', activityTypeId: typeMap['language-culture'], displayOrder: 8 },
    { code: 'other-language', name: 'Other Language & Culture', activityTypeId: typeMap['language-culture'], displayOrder: 99 },
    
    // Special Needs Programs - NEW comprehensive list
    { code: 'adaptive-sports', name: 'Adaptive Sports', activityTypeId: typeMap['special-needs-programs'], displayOrder: 1 },
    { code: 'sensory-programs', name: 'Sensory Programs', activityTypeId: typeMap['special-needs-programs'], displayOrder: 2 },
    { code: 'therapeutic-recreation', name: 'Therapeutic Recreation', activityTypeId: typeMap['special-needs-programs'], displayOrder: 3 },
    { code: 'social-skills', name: 'Social Skills', activityTypeId: typeMap['special-needs-programs'], displayOrder: 4 },
    { code: 'life-skills', name: 'Life Skills', activityTypeId: typeMap['special-needs-programs'], displayOrder: 5 },
    { code: 'mobility-programs', name: 'Mobility Programs', activityTypeId: typeMap['special-needs-programs'], displayOrder: 6 },
    { code: 'other-special-needs', name: 'Other Special Needs', activityTypeId: typeMap['special-needs-programs'], displayOrder: 99 },
    
    // Multi-Sport - NEW comprehensive list
    { code: 'multi-sport-programs', name: 'Multi-Sport Programs', activityTypeId: typeMap['multi-sport'], displayOrder: 1 },
    { code: 'sport-sampling', name: 'Sport Sampling', activityTypeId: typeMap['multi-sport'], displayOrder: 2 },
    { code: 'athletic-development', name: 'Athletic Development', activityTypeId: typeMap['multi-sport'], displayOrder: 3 },
    { code: 'fundamental-movement', name: 'Fundamental Movement', activityTypeId: typeMap['multi-sport'], displayOrder: 4 },
    { code: 'sport-introduction', name: 'Sport Introduction', activityTypeId: typeMap['multi-sport'], displayOrder: 5 },
    { code: 'other-multi-sport', name: 'Other Multi-Sport', activityTypeId: typeMap['multi-sport'], displayOrder: 99 },
    
    // Life Skills & Leadership - NEW comprehensive list
    { code: 'leadership', name: 'Leadership', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 1 },
    { code: 'babysitting', name: 'Babysitting', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 2 },
    { code: 'first-aid', name: 'First Aid', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 3 },
    { code: 'cpr-certification', name: 'CPR Certification', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 4 },
    { code: 'public-speaking', name: 'Public Speaking', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 5 },
    { code: 'financial-literacy', name: 'Financial Literacy', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 6 },
    { code: 'volunteer-training', name: 'Volunteer Training', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 7 },
    { code: 'other-life-skills', name: 'Other Life Skills', activityTypeId: typeMap['life-skills-leadership'], displayOrder: 99 },
    
    // Early Development - NEW comprehensive list
    { code: 'play-based-learning', name: 'Play Based Learning', activityTypeId: typeMap['early-development'], displayOrder: 1 },
    { code: 'parent-child', name: 'Parent & Child', activityTypeId: typeMap['early-development'], displayOrder: 2 },
    { code: 'social-development', name: 'Social Development', activityTypeId: typeMap['early-development'], displayOrder: 3 },
    { code: 'motor-skills', name: 'Motor Skills', activityTypeId: typeMap['early-development'], displayOrder: 4 },
    { code: 'pre-literacy', name: 'Pre-Literacy', activityTypeId: typeMap['early-development'], displayOrder: 5 },
    { code: 'pre-numeracy', name: 'Pre-Numeracy', activityTypeId: typeMap['early-development'], displayOrder: 6 },
    { code: 'sensory-play', name: 'Sensory Play', activityTypeId: typeMap['early-development'], displayOrder: 7 },
    { code: 'other-early-development', name: 'Other Early Development', activityTypeId: typeMap['early-development'], displayOrder: 99 },
    
    // Other Activity - Generic subtypes
    { code: 'general', name: 'General', activityTypeId: typeMap['other-activity'], displayOrder: 1 },
    { code: 'other', name: 'Other', activityTypeId: typeMap['other-activity'], displayOrder: 99 }
  ];

  for (const subtype of activitySubtypes) {
    const created = await prisma.activitySubtype.upsert({
      where: {
        activityTypeId_code: {
          activityTypeId: subtype.activityTypeId,
          code: subtype.code
        }
      },
      update: { name: subtype.name, displayOrder: subtype.displayOrder },
      create: subtype
    });
    console.log(`✅ Created activity subtype: ${created.name}`);
  }

  console.log('🎉 Enhanced activity types seed completed successfully!');
  console.log(`📊 Total Activity Types: ${activityTypes.length}`);
  console.log(`📊 Total Activity Subtypes: ${activitySubtypes.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });