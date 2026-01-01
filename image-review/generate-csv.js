// Implement getActivityImageKey logic
function getActivityImageKey(category, subcategory, activityName) {
  const parts = [activityName, subcategory, category].filter(Boolean);
  const categoryLower = parts.join(' ').toLowerCase();

  // TIER 1: Most specific
  if (categoryLower.includes('water polo')) return 'swimming';
  if (categoryLower.includes('water safety') || categoryLower.includes('lifeguard')) return 'water_safety';
  if (categoryLower.includes('diving') || categoryLower.includes('dive')) return 'diving';
  if (categoryLower.includes('figure skating')) return 'ice_skating';
  if (categoryLower.includes('ice skating')) return 'ice_skating';
  if (categoryLower.includes('roller skating') || categoryLower.includes('roller blad')) return 'ice_skating';
  if (categoryLower.includes('skateboard') || categoryLower.includes('skate park')) return 'skateboarding';
  if (categoryLower.includes('ballet') || categoryLower.includes('pointe')) return 'ballet';
  if (categoryLower.includes('hip hop') || categoryLower.includes('hip-hop') || categoryLower.includes('hiphop')) return 'hip_hop_dance';
  if (categoryLower.includes('jazz dance')) return 'dance';
  if (categoryLower.includes('tap dance')) return 'dance';
  if (categoryLower.includes('kung fu')) return 'martial_arts';
  if (categoryLower.includes('jiu jitsu') || categoryLower.includes('jujitsu')) return 'martial_arts';
  if (categoryLower.includes('tae kwon do') || categoryLower.includes('taekwondo')) return 'martial_arts';
  if (categoryLower.includes('karate')) return 'karate';
  if (categoryLower.includes('judo')) return 'martial_arts';
  if (categoryLower.includes('cross country')) return 'running';
  if (categoryLower.includes('track and field') || categoryLower.includes('track & field')) return 'running';

  // TIER 2: Specific single-word
  if (categoryLower.includes('basketball')) return 'basketball';
  if (categoryLower.includes('soccer')) return 'soccer';
  if (categoryLower.includes('hockey')) return 'hockey';
  if (categoryLower.includes('volleyball')) return 'volleyball';
  if (categoryLower.includes('baseball') || categoryLower.includes('softball')) return 'baseball';
  if (categoryLower.includes('tennis')) return 'tennis';
  if (categoryLower.includes('badminton')) return 'badminton';
  if (categoryLower.includes('squash') || categoryLower.includes('pickleball') || categoryLower.includes('table tennis')) return 'racquet_sports';
  if (categoryLower.includes('lacrosse') || categoryLower.includes('rugby')) return 'sports_general';
  if (categoryLower.includes('gymnastics') || categoryLower.includes('tumbling')) return 'gymnastics';
  if (categoryLower.includes('trampoline')) return 'gymnastics';
  if (categoryLower.includes('parkour')) return 'gymnastics';
  if (categoryLower.includes('cheerleading') || categoryLower.includes('cheer')) return 'cheerleading';
  if (categoryLower.includes('yoga')) return 'yoga';
  if (categoryLower.includes('pilates')) return 'yoga';
  if (categoryLower.includes('zumba')) return 'fitness';
  if (categoryLower.includes('meditation')) return 'yoga';
  if (categoryLower.includes('climbing') || categoryLower.includes('bouldering')) return 'climbing';
  if (categoryLower.includes('running')) return 'running';
  if (categoryLower.includes('cycling')) return 'sports_general';
  if (categoryLower.includes('bmx')) return 'sports_general';
  if (categoryLower.includes('scooter')) return 'sports_general';
  if (categoryLower.includes('skiing') || categoryLower.includes('snowboard')) return 'skiing';
  if (categoryLower.includes('hiking')) return 'hiking';
  if (categoryLower.includes('swimming') || categoryLower.includes('swim') || categoryLower.includes('aquatic')) return 'swimming';
  if (categoryLower.includes('piano') || categoryLower.includes('keyboard')) return 'piano';
  if (categoryLower.includes('guitar') || categoryLower.includes('ukulele')) return 'guitar';
  if (categoryLower.includes('drums') || categoryLower.includes('percussion')) return 'drums';
  if (categoryLower.includes('violin') || categoryLower.includes('flute') || categoryLower.includes('brass') || categoryLower.includes('woodwind')) return 'music';
  if (categoryLower.includes('choir') || categoryLower.includes('singing') || categoryLower.includes('voice')) return 'music';
  if (categoryLower.includes('band') || categoryLower.includes('orchestra')) return 'music';
  if (categoryLower.includes('pottery') || categoryLower.includes('ceramic') || categoryLower.includes('clay')) return 'pottery';
  if (categoryLower.includes('painting') || categoryLower.includes('watercolor')) return 'painting';
  if (categoryLower.includes('theater') || categoryLower.includes('theatre') || categoryLower.includes('drama') || categoryLower.includes('acting')) return 'theater';
  if (categoryLower.includes('improv') || categoryLower.includes('comedy')) return 'theater';
  if (categoryLower.includes('musical theatre')) return 'theater';
  if (categoryLower.includes('circus')) return 'theater';
  if (categoryLower.includes('cooking') || categoryLower.includes('culinary') || categoryLower.includes('baking')) return 'cooking';
  if (categoryLower.includes('pastry') || categoryLower.includes('cake')) return 'cooking';
  if (categoryLower.includes('science')) return 'science';
  if (categoryLower.includes('robotics') || categoryLower.includes('coding') || categoryLower.includes('programming') || categoryLower.includes('lego')) return 'stem';
  if (categoryLower.includes('3d printing') || categoryLower.includes('maker')) return 'stem';
  if (categoryLower.includes('computer')) return 'stem';
  if (categoryLower.includes('french') || categoryLower.includes('spanish') || categoryLower.includes('mandarin')) return 'language';
  if (categoryLower.includes('german') || categoryLower.includes('italian') || categoryLower.includes('japanese')) return 'language';
  if (categoryLower.includes('sign language')) return 'language';
  if (categoryLower.includes('reading') || categoryLower.includes('library') || categoryLower.includes('literacy')) return 'reading';
  if (categoryLower.includes('camping') || categoryLower.includes('camp')) return 'summer_camp';
  if (categoryLower.includes('nature') || categoryLower.includes('wildlife') || categoryLower.includes('forest')) return 'nature';
  if (categoryLower.includes('kayak') || categoryLower.includes('canoe')) return 'outdoor';
  if (categoryLower.includes('fishing')) return 'outdoor';
  if (categoryLower.includes('survival')) return 'outdoor';
  if (categoryLower.includes('toddler') || categoryLower.includes('infant') || categoryLower.includes('baby')) return 'early_years';
  if (categoryLower.includes('preschool') || categoryLower.includes('kindergarten')) return 'preschool';
  if (categoryLower.includes('parent & child') || categoryLower.includes('parent-child')) return 'early_years';
  if (categoryLower.includes('play based') || categoryLower.includes('sensory play')) return 'early_years';
  if (categoryLower.includes('motor skills')) return 'early_years';
  if (categoryLower.includes('babysit') || categoryLower.includes('leadership') || categoryLower.includes('certification')) return 'leadership';
  if (categoryLower.includes('first aid') || categoryLower.includes('cpr')) return 'leadership';
  if (categoryLower.includes('public speaking')) return 'leadership';
  if (categoryLower.includes('volunteer')) return 'leadership';
  if (categoryLower.includes('adaptive') || categoryLower.includes('therapeutic')) return 'recreation_center';
  if (categoryLower.includes('special needs')) return 'recreation_center';
  if (categoryLower.includes('golf')) return 'sports_general';
  if (categoryLower.includes('bowling')) return 'sports_general';
  if (categoryLower.includes('archery')) return 'sports_general';
  if (categoryLower.includes('fencing')) return 'sports_general';
  if (categoryLower.includes('triathlon')) return 'running';
  if (categoryLower.includes('cricket')) return 'sports_general';
  if (categoryLower.includes('frisbee')) return 'sports_general';
  if (categoryLower.includes('football')) return 'soccer';
  if (categoryLower.includes('breakdancing')) return 'hip_hop_dance';
  if (categoryLower.includes('bollywood')) return 'dance';
  if (categoryLower.includes('latin') || categoryLower.includes('salsa')) return 'dance';
  if (categoryLower.includes('irish')) return 'dance';
  if (categoryLower.includes('african')) return 'dance';
  if (categoryLower.includes('ballroom')) return 'dance';
  if (categoryLower.includes('contemporary') || categoryLower.includes('modern')) return 'dance';
  if (categoryLower.includes('drawing') || categoryLower.includes('sketch')) return 'painting';
  if (categoryLower.includes('sculpture')) return 'arts_crafts';
  if (categoryLower.includes('photography')) return 'arts_crafts';
  if (categoryLower.includes('digital art')) return 'arts_crafts';
  if (categoryLower.includes('jewelry')) return 'crafts';
  if (categoryLower.includes('fashion')) return 'crafts';
  if (categoryLower.includes('puppetry') || categoryLower.includes('storytelling')) return 'theater';
  if (categoryLower.includes('film')) return 'theater';

  // TIER 3: Category-level
  if (categoryLower.includes('skating') || categoryLower.includes('skate')) return 'ice_skating';
  if (categoryLower.includes('dance') || categoryLower.includes('dancing') || categoryLower.includes('movement')) return 'dance';
  if (categoryLower.includes('martial')) return 'martial_arts';
  if (categoryLower.includes('music')) return 'music';
  if (categoryLower.includes('craft') || categoryLower.includes('sewing') || categoryLower.includes('knitting')) return 'crafts';
  if (categoryLower.includes('paint') || categoryLower.includes('drawing') || categoryLower.includes('draw')) return 'painting';
  if (categoryLower.includes('art') || categoryLower.includes('creative') || categoryLower.includes('visual')) return 'arts_crafts';
  if (categoryLower.includes('fitness') || categoryLower.includes('workout') || categoryLower.includes('exercise') || categoryLower.includes('cardio') || categoryLower.includes('aerobics') || categoryLower.includes('strength') || categoryLower.includes('spinning')) return 'fitness';
  if (categoryLower.includes('stem') || categoryLower.includes('technology') || categoryLower.includes('engineering') || categoryLower.includes('math')) return 'stem';
  if (categoryLower.includes('language') || categoryLower.includes('culture')) return 'language';
  if (categoryLower.includes('outdoor') || categoryLower.includes('adventure')) return 'outdoor';
  if (categoryLower.includes('racquet')) return 'racquet_sports';
  if (categoryLower.includes('track')) return 'running';
  if (categoryLower.includes('perform')) return 'theater';

  // TIER 4: Generic
  if (categoryLower.includes('youth') || categoryLower.includes('teen') || categoryLower.includes('junior')) return 'youth_activities';
  if (categoryLower.includes('multisport') || categoryLower.includes('multi-sport') || categoryLower.includes('multi sport')) return 'sports_general';
  if (categoryLower.includes('sport') || categoryLower.includes('athletic')) return 'sports_general';
  if (categoryLower.includes('kid') || categoryLower.includes('child')) return 'kids_activities';
  if (categoryLower.includes('family')) return 'family_fun';
  if (categoryLower.includes('recreation') || categoryLower.includes('rec ')) return 'recreation_center';
  if (categoryLower.includes('community')) return 'community_center';
  if (categoryLower.includes('early') || categoryLower.includes('development')) return 'early_years';
  if (categoryLower.includes('life skill') || categoryLower.includes('social')) return 'leadership';

  return 'recreation_center';
}

// Activity types and subtypes from seed file
const data = [
  // Swimming & Aquatics
  { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
  { type: 'Swimming & Aquatics', subtype: 'Competitive Swimming' },
  { type: 'Swimming & Aquatics', subtype: 'Diving' },
  { type: 'Swimming & Aquatics', subtype: 'Water Polo' },
  { type: 'Swimming & Aquatics', subtype: 'Synchronized Swimming' },
  { type: 'Swimming & Aquatics', subtype: 'Aqua Fitness' },
  { type: 'Swimming & Aquatics', subtype: 'Lifeguarding' },
  { type: 'Swimming & Aquatics', subtype: 'Swim Camp' },

  // Team Sports
  { type: 'Team Sports', subtype: 'Basketball' },
  { type: 'Team Sports', subtype: 'Soccer' },
  { type: 'Team Sports', subtype: 'Volleyball' },
  { type: 'Team Sports', subtype: 'Baseball' },
  { type: 'Team Sports', subtype: 'Softball' },
  { type: 'Team Sports', subtype: 'Hockey' },
  { type: 'Team Sports', subtype: 'Floor Hockey' },
  { type: 'Team Sports', subtype: 'Football' },
  { type: 'Team Sports', subtype: 'Flag Football' },
  { type: 'Team Sports', subtype: 'Lacrosse' },
  { type: 'Team Sports', subtype: 'Rugby' },
  { type: 'Team Sports', subtype: 'Cricket' },
  { type: 'Team Sports', subtype: 'Ultimate Frisbee' },

  // Individual Sports
  { type: 'Individual Sports', subtype: 'Track & Field' },
  { type: 'Individual Sports', subtype: 'Running' },
  { type: 'Individual Sports', subtype: 'Cycling' },
  { type: 'Individual Sports', subtype: 'Golf' },
  { type: 'Individual Sports', subtype: 'Bowling' },
  { type: 'Individual Sports', subtype: 'Archery' },
  { type: 'Individual Sports', subtype: 'Fencing' },
  { type: 'Individual Sports', subtype: 'Rock Climbing' },
  { type: 'Individual Sports', subtype: 'Cross Country' },
  { type: 'Individual Sports', subtype: 'Triathlon' },

  // Racquet Sports
  { type: 'Racquet Sports', subtype: 'Tennis' },
  { type: 'Racquet Sports', subtype: 'Badminton' },
  { type: 'Racquet Sports', subtype: 'Squash' },
  { type: 'Racquet Sports', subtype: 'Racquetball' },
  { type: 'Racquet Sports', subtype: 'Pickleball' },
  { type: 'Racquet Sports', subtype: 'Table Tennis' },

  // Martial Arts
  { type: 'Martial Arts', subtype: 'Karate' },
  { type: 'Martial Arts', subtype: 'Taekwondo' },
  { type: 'Martial Arts', subtype: 'Judo' },
  { type: 'Martial Arts', subtype: 'Jiu-Jitsu' },
  { type: 'Martial Arts', subtype: 'Kung Fu' },
  { type: 'Martial Arts', subtype: 'Aikido' },
  { type: 'Martial Arts', subtype: 'Boxing' },
  { type: 'Martial Arts', subtype: 'Kickboxing' },
  { type: 'Martial Arts', subtype: 'Mixed Martial Arts' },
  { type: 'Martial Arts', subtype: 'Self Defense' },

  // Dance
  { type: 'Dance', subtype: 'Ballet' },
  { type: 'Dance', subtype: 'Jazz' },
  { type: 'Dance', subtype: 'Tap' },
  { type: 'Dance', subtype: 'Hip Hop' },
  { type: 'Dance', subtype: 'Contemporary' },
  { type: 'Dance', subtype: 'Modern' },
  { type: 'Dance', subtype: 'Ballroom' },
  { type: 'Dance', subtype: 'Latin' },
  { type: 'Dance', subtype: 'Salsa' },
  { type: 'Dance', subtype: 'Bollywood' },
  { type: 'Dance', subtype: 'Irish' },
  { type: 'Dance', subtype: 'African' },
  { type: 'Dance', subtype: 'Breakdancing' },
  { type: 'Dance', subtype: 'Creative Movement' },

  // Visual Arts
  { type: 'Visual Arts', subtype: 'Painting' },
  { type: 'Visual Arts', subtype: 'Drawing' },
  { type: 'Visual Arts', subtype: 'Sculpture' },
  { type: 'Visual Arts', subtype: 'Pottery' },
  { type: 'Visual Arts', subtype: 'Ceramics' },
  { type: 'Visual Arts', subtype: 'Photography' },
  { type: 'Visual Arts', subtype: 'Digital Art' },
  { type: 'Visual Arts', subtype: 'Printmaking' },
  { type: 'Visual Arts', subtype: 'Mixed Media' },
  { type: 'Visual Arts', subtype: 'Crafts' },
  { type: 'Visual Arts', subtype: 'Jewelry Making' },
  { type: 'Visual Arts', subtype: 'Fashion Design' },

  // Music
  { type: 'Music', subtype: 'Piano' },
  { type: 'Music', subtype: 'Guitar' },
  { type: 'Music', subtype: 'Violin' },
  { type: 'Music', subtype: 'Drums' },
  { type: 'Music', subtype: 'Voice/Singing' },
  { type: 'Music', subtype: 'Band' },
  { type: 'Music', subtype: 'Orchestra' },
  { type: 'Music', subtype: 'Choir' },
  { type: 'Music', subtype: 'Ukulele' },
  { type: 'Music', subtype: 'Brass Instruments' },
  { type: 'Music', subtype: 'Woodwind Instruments' },
  { type: 'Music', subtype: 'Music Theory' },
  { type: 'Music', subtype: 'Music Production' },

  // Performing Arts
  { type: 'Performing Arts', subtype: 'Drama' },
  { type: 'Performing Arts', subtype: 'Musical Theatre' },
  { type: 'Performing Arts', subtype: 'Acting' },
  { type: 'Performing Arts', subtype: 'Improv' },
  { type: 'Performing Arts', subtype: 'Comedy' },
  { type: 'Performing Arts', subtype: 'Circus Arts' },
  { type: 'Performing Arts', subtype: 'Puppetry' },
  { type: 'Performing Arts', subtype: 'Storytelling' },
  { type: 'Performing Arts', subtype: 'Film Making' },

  // Skating & Wheels
  { type: 'Skating & Wheels', subtype: 'Ice Skating' },
  { type: 'Skating & Wheels', subtype: 'Figure Skating' },
  { type: 'Skating & Wheels', subtype: 'Roller Skating' },
  { type: 'Skating & Wheels', subtype: 'Inline Skating' },
  { type: 'Skating & Wheels', subtype: 'Skateboarding' },
  { type: 'Skating & Wheels', subtype: 'Scooter' },
  { type: 'Skating & Wheels', subtype: 'Cycling' },
  { type: 'Skating & Wheels', subtype: 'BMX' },

  // Gymnastics & Movement
  { type: 'Gymnastics & Movement', subtype: 'Gymnastics' },
  { type: 'Gymnastics & Movement', subtype: 'Tumbling' },
  { type: 'Gymnastics & Movement', subtype: 'Trampoline' },
  { type: 'Gymnastics & Movement', subtype: 'Parkour' },
  { type: 'Gymnastics & Movement', subtype: 'Acrobatics' },
  { type: 'Gymnastics & Movement', subtype: 'Cheerleading' },
  { type: 'Gymnastics & Movement', subtype: 'Rhythmic Gymnastics' },

  // Camps
  { type: 'Camps', subtype: 'Day Camps' },
  { type: 'Camps', subtype: 'Overnight Camps' },
  { type: 'Camps', subtype: 'Swimming Camps' },
  { type: 'Camps', subtype: 'Team Sports Camps' },
  { type: 'Camps', subtype: 'Dance Camps' },
  { type: 'Camps', subtype: 'Music Camps' },
  { type: 'Camps', subtype: 'Performing Arts Camps' },
  { type: 'Camps', subtype: 'Visual Arts Camps' },
  { type: 'Camps', subtype: 'Martial Arts Camps' },
  { type: 'Camps', subtype: 'Gymnastics Camps' },
  { type: 'Camps', subtype: 'Skating Camps' },
  { type: 'Camps', subtype: 'Outdoor Adventure Camps' },
  { type: 'Camps', subtype: 'Cooking Camps' },
  { type: 'Camps', subtype: 'Language Camps' },
  { type: 'Camps', subtype: 'Multi-Activity Camps' },
  { type: 'Camps', subtype: 'Sports Camps' },
  { type: 'Camps', subtype: 'Arts Camps' },
  { type: 'Camps', subtype: 'STEM Camps' },
  { type: 'Camps', subtype: 'Adventure Camps' },
  { type: 'Camps', subtype: 'March Break Camps' },
  { type: 'Camps', subtype: 'Summer Camps' },
  { type: 'Camps', subtype: 'Winter Camps' },

  // STEM & Education
  { type: 'STEM & Education', subtype: 'Science' },
  { type: 'STEM & Education', subtype: 'Coding' },
  { type: 'STEM & Education', subtype: 'Robotics' },
  { type: 'STEM & Education', subtype: 'Engineering' },
  { type: 'STEM & Education', subtype: 'Mathematics' },
  { type: 'STEM & Education', subtype: 'Technology' },
  { type: 'STEM & Education', subtype: 'Computer Science' },
  { type: 'STEM & Education', subtype: 'Maker Space' },
  { type: 'STEM & Education', subtype: '3D Printing' },

  // Fitness & Wellness
  { type: 'Fitness & Wellness', subtype: 'Yoga' },
  { type: 'Fitness & Wellness', subtype: 'Pilates' },
  { type: 'Fitness & Wellness', subtype: 'Zumba' },
  { type: 'Fitness & Wellness', subtype: 'Strength Training' },
  { type: 'Fitness & Wellness', subtype: 'Cardio Fitness' },
  { type: 'Fitness & Wellness', subtype: 'Spinning' },
  { type: 'Fitness & Wellness', subtype: 'Aerobics' },
  { type: 'Fitness & Wellness', subtype: 'Meditation' },

  // Outdoor & Adventure
  { type: 'Outdoor & Adventure', subtype: 'Hiking' },
  { type: 'Outdoor & Adventure', subtype: 'Rock Climbing' },
  { type: 'Outdoor & Adventure', subtype: 'Camping' },
  { type: 'Outdoor & Adventure', subtype: 'Kayaking' },
  { type: 'Outdoor & Adventure', subtype: 'Canoeing' },
  { type: 'Outdoor & Adventure', subtype: 'Fishing' },
  { type: 'Outdoor & Adventure', subtype: 'Nature Exploration' },
  { type: 'Outdoor & Adventure', subtype: 'Survival Skills' },
  { type: 'Outdoor & Adventure', subtype: 'Orienteering' },

  // Culinary Arts
  { type: 'Culinary Arts', subtype: 'Cooking Classes' },
  { type: 'Culinary Arts', subtype: 'Baking' },
  { type: 'Culinary Arts', subtype: 'Pastry Arts' },
  { type: 'Culinary Arts', subtype: 'Knife Skills' },
  { type: 'Culinary Arts', subtype: 'International Cuisine' },
  { type: 'Culinary Arts', subtype: 'Healthy Cooking' },
  { type: 'Culinary Arts', subtype: 'Food Safety' },
  { type: 'Culinary Arts', subtype: 'Cake Decorating' },

  // Language & Culture
  { type: 'Language & Culture', subtype: 'French' },
  { type: 'Language & Culture', subtype: 'Spanish' },
  { type: 'Language & Culture', subtype: 'Mandarin' },
  { type: 'Language & Culture', subtype: 'German' },
  { type: 'Language & Culture', subtype: 'Italian' },
  { type: 'Language & Culture', subtype: 'Japanese' },
  { type: 'Language & Culture', subtype: 'Sign Language' },
  { type: 'Language & Culture', subtype: 'Cultural Studies' },

  // Special Needs Programs
  { type: 'Special Needs Programs', subtype: 'Adaptive Sports' },
  { type: 'Special Needs Programs', subtype: 'Sensory Programs' },
  { type: 'Special Needs Programs', subtype: 'Therapeutic Recreation' },
  { type: 'Special Needs Programs', subtype: 'Social Skills' },
  { type: 'Special Needs Programs', subtype: 'Life Skills' },
  { type: 'Special Needs Programs', subtype: 'Mobility Programs' },

  // Multi-Sport
  { type: 'Multi-Sport', subtype: 'Multi-Sport Programs' },
  { type: 'Multi-Sport', subtype: 'Sport Sampling' },
  { type: 'Multi-Sport', subtype: 'Athletic Development' },
  { type: 'Multi-Sport', subtype: 'Fundamental Movement' },
  { type: 'Multi-Sport', subtype: 'Sport Introduction' },

  // Life Skills & Leadership
  { type: 'Life Skills & Leadership', subtype: 'Leadership' },
  { type: 'Life Skills & Leadership', subtype: 'Babysitting' },
  { type: 'Life Skills & Leadership', subtype: 'First Aid' },
  { type: 'Life Skills & Leadership', subtype: 'CPR Certification' },
  { type: 'Life Skills & Leadership', subtype: 'Public Speaking' },
  { type: 'Life Skills & Leadership', subtype: 'Financial Literacy' },
  { type: 'Life Skills & Leadership', subtype: 'Volunteer Training' },

  // Early Development
  { type: 'Early Development', subtype: 'Play Based Learning' },
  { type: 'Early Development', subtype: 'Parent & Child' },
  { type: 'Early Development', subtype: 'Social Development' },
  { type: 'Early Development', subtype: 'Motor Skills' },
  { type: 'Early Development', subtype: 'Pre-Literacy' },
  { type: 'Early Development', subtype: 'Pre-Numeracy' },
  { type: 'Early Development', subtype: 'Sensory Play' },

  // Other Activity
  { type: 'Other Activity', subtype: 'General' },
  { type: 'Other Activity', subtype: 'Other' }
];

// Generate CSV
console.log('Activity Type,Subtype,Mapped Image Key');
data.forEach(item => {
  const imageKey = getActivityImageKey(item.type, item.subtype, '');
  console.log(`"${item.type}","${item.subtype}","${imageKey}"`);
});
