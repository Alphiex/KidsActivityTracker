const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

// Enhanced subtype detection with more specific patterns
function detectSpecificSubtype(name, subcategory, activityType) {
  const combined = `${name} ${subcategory}`.toLowerCase();
  
  switch(activityType) {
    case 'Dance':
      // Check for specific dance types (order matters - most specific first)
      if (combined.includes('ballet')) return 'Ballet';
      if (combined.includes('jazz') && !combined.includes('jazzercise')) return 'Jazz';
      if (combined.includes('hip hop') || combined.includes('hip-hop') || combined.includes('hiphop')) return 'Hip Hop';
      if (combined.includes('tap') && !combined.includes('taping')) return 'Tap';
      if (combined.includes('contemporary')) return 'Contemporary';
      if (combined.includes('modern') && combined.includes('dance')) return 'Modern';
      if (combined.includes('bollywood')) return 'Bollywood';
      if (combined.includes('breakdance') || combined.includes('break dance') || combined.includes('breaking')) return 'Breakdancing';
      if (combined.includes('ballroom')) return 'Ballroom';
      if (combined.includes('salsa')) return 'Salsa';
      if (combined.includes('latin')) return 'Latin';
      if (combined.includes('irish')) return 'Irish';
      if (combined.includes('folk')) return 'Folk';
      if (combined.includes('creative') && combined.includes('movement')) return 'Creative Movement';
      if (combined.includes('lyrical')) return 'Lyrical';
      if (combined.includes('acro')) return 'Acro Dance';
      if (combined.includes('dance')) return 'General Dance';
      return 'General Dance';
      
    case 'Music':
      // Check for specific music types
      if (combined.includes('piano')) return 'Piano';
      if (combined.includes('guitar')) return 'Guitar';
      if (combined.includes('violin')) return 'Violin';
      if (combined.includes('drum')) return 'Drums';
      if (combined.includes('voice') || combined.includes('vocal') || combined.includes('singing') || combined.includes('choir')) return 'Voice & Singing';
      if (combined.includes('ukulele')) return 'Ukulele';
      if (combined.includes('keyboard')) return 'Keyboard';
      if (combined.includes('flute')) return 'Flute';
      if (combined.includes('saxophone') || combined.includes('sax')) return 'Saxophone';
      if (combined.includes('trumpet')) return 'Trumpet';
      if (combined.includes('cello')) return 'Cello';
      if (combined.includes('clarinet')) return 'Clarinet';
      if (combined.includes('band') && !combined.includes('rubber')) return 'Band';
      if (combined.includes('orchestra')) return 'Orchestra';
      if (combined.includes('music theory')) return 'Music Theory';
      if (combined.includes('composition')) return 'Composition';
      if (combined.includes('music')) return 'General Music';
      return 'General Music';
      
    case 'Visual Arts':
      // Check for specific art types
      if (combined.includes('painting') || combined.includes('paint')) return 'Painting';
      if (combined.includes('drawing') || combined.includes('draw') || combined.includes('sketch')) return 'Drawing';
      if (combined.includes('pottery') || combined.includes('ceramics') || combined.includes('clay')) return 'Pottery & Ceramics';
      if (combined.includes('sculpture') || combined.includes('sculpt')) return 'Sculpture';
      if (combined.includes('photography') || combined.includes('photo')) return 'Photography';
      if (combined.includes('digital art') || combined.includes('digital')) return 'Digital Art';
      if (combined.includes('craft')) return 'Crafts';
      if (combined.includes('mixed media')) return 'Mixed Media';
      if (combined.includes('printmaking') || combined.includes('print making')) return 'Printmaking';
      if (combined.includes('jewelry') || combined.includes('jewellery')) return 'Jewelry Making';
      if (combined.includes('textile') || combined.includes('fabric') || combined.includes('sewing')) return 'Textiles';
      if (combined.includes('watercolor') || combined.includes('watercolour')) return 'Watercolor';
      if (combined.includes('cartoon') || combined.includes('anime') || combined.includes('manga')) return 'Cartooning';
      if (combined.includes('calligraphy')) return 'Calligraphy';
      if (combined.includes('art')) return 'General Art';
      return 'General Art';
      
    case 'Fitness & Wellness':
      // Check for specific fitness types
      if (combined.includes('yoga')) return 'Yoga';
      if (combined.includes('pilates')) return 'Pilates';
      if (combined.includes('zumba')) return 'Zumba';
      if (combined.includes('aerobic')) return 'Aerobics';
      if (combined.includes('strength') || combined.includes('weight')) return 'Strength Training';
      if (combined.includes('cardio')) return 'Cardio';
      if (combined.includes('crossfit') || combined.includes('cross fit')) return 'CrossFit';
      if (combined.includes('bootcamp') || combined.includes('boot camp')) return 'Boot Camp';
      if (combined.includes('mindful') || combined.includes('meditation')) return 'Mindfulness';
      if (combined.includes('fitness')) return 'General Fitness';
      return 'Wellness';
      
    case 'Camps':
      // Check for specific camp types
      if (combined.includes('overnight') || combined.includes('sleep away') || combined.includes('residential')) return 'Overnight Camp';
      if (combined.includes('day camp') || combined.includes('full day')) return 'Full Day Camp';
      if (combined.includes('part day') || combined.includes('half day') || combined.includes('morning') || combined.includes('afternoon')) return 'Part Day Camp';
      if (combined.includes('sport')) return 'Sports Camp';
      if (combined.includes('art')) return 'Arts Camp';
      if (combined.includes('science')) return 'Science Camp';
      if (combined.includes('tech') || combined.includes('computer') || combined.includes('coding')) return 'Tech Camp';
      if (combined.includes('music')) return 'Music Camp';
      if (combined.includes('dance')) return 'Dance Camp';
      if (combined.includes('drama') || combined.includes('theatre') || combined.includes('theater')) return 'Drama Camp';
      if (combined.includes('nature') || combined.includes('outdoor') || combined.includes('adventure')) return 'Outdoor Camp';
      if (combined.includes('leader')) return 'Leadership Camp';
      if (combined.includes('spring')) return 'Spring Camp';
      if (combined.includes('summer')) return 'Summer Camp';
      if (combined.includes('winter')) return 'Winter Camp';
      if (combined.includes('march') || combined.includes('break')) return 'March Break Camp';
      if (combined.includes('camp')) return 'General Camp';
      return 'General Camp';
      
    default:
      return null;
  }
}

// Main mapping function with enhanced subtype detection
function mapActivityComprehensive(activity) {
  const name = activity.name?.toLowerCase() || '';
  const subcategory = activity.subcategory?.toLowerCase() || '';
  let activityType = null;
  let activitySubtype = null;
  
  // Priority 1: Check for camps FIRST (to avoid misclassification)
  if (subcategory.includes('camp') || name.includes('camp')) {
    activityType = 'Camps';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Camps');
    return { activityType, activitySubtype };
  }
  
  // Priority 2: Check subcategory field first for better accuracy
  
  // Swimming & Aquatics
  if (subcategory.includes('swim') || subcategory.includes('aqua')) {
    activityType = 'Swimming & Aquatics';
    if (subcategory.includes('lesson') || subcategory.includes('learn')) {
      activitySubtype = 'Swimming Lessons';
    } else if (subcategory.includes('competitive') || subcategory.includes('team')) {
      activitySubtype = 'Competitive Swimming';
    } else if (subcategory.includes('aquafit') || subcategory.includes('aqua fit')) {
      activitySubtype = 'Aquafit';
    } else if (subcategory.includes('lifeguard') || subcategory.includes('lifesaving')) {
      activitySubtype = 'Lifeguarding';
    } else if (subcategory.includes('diving')) {
      activitySubtype = 'Diving';
    } else if (subcategory.includes('water polo')) {
      activitySubtype = 'Water Polo';
    } else {
      activitySubtype = 'General Swimming';
    }
    return { activityType, activitySubtype };
  }
  
  // Visual Arts
  if (subcategory.includes('visual arts') || subcategory.includes('art')) {
    activityType = 'Visual Arts';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Visual Arts');
    return { activityType, activitySubtype };
  }
  
  // Music
  if (subcategory.includes('music') || subcategory.includes('piano') || 
      subcategory.includes('guitar') || subcategory.includes('violin') || 
      subcategory.includes('vocal')) {
    activityType = 'Music';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Music');
    return { activityType, activitySubtype };
  }
  
  // Cooking
  if (subcategory.includes('cook') || subcategory.includes('culinary') || subcategory.includes('bak')) {
    activityType = 'Culinary Arts';
    activitySubtype = subcategory.includes('bak') ? 'Baking' : 'Cooking';
    return { activityType, activitySubtype };
  }
  
  // Yoga/Fitness
  if (subcategory.includes('yoga') || subcategory.includes('fitness') || 
      subcategory.includes('pilates') || subcategory.includes('zumba')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Fitness & Wellness');
    return { activityType, activitySubtype };
  }
  
  // Team Sports
  if (subcategory.includes('basketball') || subcategory.includes('soccer') || 
      subcategory.includes('volleyball') || subcategory.includes('baseball') || 
      subcategory.includes('football') || subcategory.includes('lacrosse') ||
      subcategory.includes('rugby') || subcategory.includes('field hockey')) {
    activityType = 'Team Sports';
    if (subcategory.includes('basketball')) {
      activitySubtype = 'Basketball';
    } else if (subcategory.includes('soccer')) {
      activitySubtype = 'Soccer';
    } else if (subcategory.includes('volleyball')) {
      activitySubtype = 'Volleyball';
    } else if (subcategory.includes('baseball') || subcategory.includes('t-ball') || subcategory.includes('tball')) {
      activitySubtype = 'Baseball';
    } else if (subcategory.includes('football')) {
      activitySubtype = 'Football';
    } else if (subcategory.includes('lacrosse')) {
      activitySubtype = 'Lacrosse';
    } else if (subcategory.includes('rugby')) {
      activitySubtype = 'Rugby';
    } else if (subcategory.includes('field hockey')) {
      activitySubtype = 'Field Hockey';
    } else {
      activitySubtype = 'Mixed Team Sports';
    }
    return { activityType, activitySubtype };
  }
  
  // Individual Sports
  if (subcategory.includes('tennis') || subcategory.includes('badminton') || 
      subcategory.includes('squash') || subcategory.includes('racquet')) {
    activityType = 'Individual Sports';
    if (subcategory.includes('tennis')) {
      activitySubtype = 'Tennis';
    } else if (subcategory.includes('badminton')) {
      activitySubtype = 'Badminton';
    } else if (subcategory.includes('squash')) {
      activitySubtype = 'Squash';
    } else if (subcategory.includes('racquet')) {
      activitySubtype = 'Racquet Sports';
    } else {
      activitySubtype = 'General Individual Sports';
    }
    return { activityType, activitySubtype };
  }
  
  // Gymnastics
  if (subcategory.includes('gymnast') || subcategory.includes('tumbl')) {
    activityType = 'Gymnastics';
    if (subcategory.includes('rhythmic')) {
      activitySubtype = 'Rhythmic Gymnastics';
    } else if (subcategory.includes('artistic')) {
      activitySubtype = 'Artistic Gymnastics';
    } else if (subcategory.includes('trampoline')) {
      activitySubtype = 'Trampoline';
    } else {
      activitySubtype = 'General Gymnastics';
    }
    return { activityType, activitySubtype };
  }
  
  // Martial Arts
  if (subcategory.includes('martial') || subcategory.includes('karate') || 
      subcategory.includes('taekwondo') || subcategory.includes('judo') ||
      subcategory.includes('kung fu') || subcategory.includes('aikido')) {
    activityType = 'Martial Arts';
    if (subcategory.includes('karate')) {
      activitySubtype = 'Karate';
    } else if (subcategory.includes('taekwondo')) {
      activitySubtype = 'Taekwondo';
    } else if (subcategory.includes('judo')) {
      activitySubtype = 'Judo';
    } else if (subcategory.includes('kung fu')) {
      activitySubtype = 'Kung Fu';
    } else if (subcategory.includes('aikido')) {
      activitySubtype = 'Aikido';
    } else {
      activitySubtype = 'Mixed Martial Arts';
    }
    return { activityType, activitySubtype };
  }
  
  // Dance
  if (subcategory.includes('dance') || subcategory.includes('ballet') || 
      subcategory.includes('hip hop') || subcategory.includes('jazz')) {
    activityType = 'Dance';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Dance');
    return { activityType, activitySubtype };
  }
  
  // Skating
  if (subcategory.includes('skat') || subcategory.includes('skating')) {
    activityType = 'Skating & Wheels';
    if (subcategory.includes('figure')) {
      activitySubtype = 'Figure Skating';
    } else if (subcategory.includes('hockey')) {
      activitySubtype = 'Hockey Skating';
    } else {
      activitySubtype = 'Ice Skating';
    }
    return { activityType, activitySubtype };
  }
  
  // Drama & Theatre
  if (subcategory.includes('drama') || subcategory.includes('theatre') || 
      subcategory.includes('theater') || subcategory.includes('acting')) {
    activityType = 'Drama & Theatre';
    if (subcategory.includes('musical')) {
      activitySubtype = 'Musical Theatre';
    } else if (subcategory.includes('improv')) {
      activitySubtype = 'Improv';
    } else {
      activitySubtype = 'General Theatre';
    }
    return { activityType, activitySubtype };
  }
  
  // STEM
  if (subcategory.includes('science') || subcategory.includes('stem') || 
      subcategory.includes('robot') || subcategory.includes('coding') ||
      subcategory.includes('engineering')) {
    activityType = 'STEM';
    if (subcategory.includes('robot')) {
      activitySubtype = 'Robotics';
    } else if (subcategory.includes('coding') || subcategory.includes('programming')) {
      activitySubtype = 'Coding';
    } else if (subcategory.includes('engineering')) {
      activitySubtype = 'Engineering';
    } else {
      activitySubtype = 'Science';
    }
    return { activityType, activitySubtype };
  }
  
  // Priority 3: Check activity name if subcategory didn't match
  
  // Swimming (check name)
  if (name.includes('swim') || name.includes('aqua')) {
    activityType = 'Swimming & Aquatics';
    if (name.includes('lesson') || name.includes('learn')) {
      activitySubtype = 'Swimming Lessons';
    } else if (name.includes('competitive') || name.includes('team')) {
      activitySubtype = 'Competitive Swimming';
    } else if (name.includes('aquafit')) {
      activitySubtype = 'Aquafit';
    } else {
      activitySubtype = 'General Swimming';
    }
    return { activityType, activitySubtype };
  }
  
  // Team Sports (check name)
  if (name.includes('basketball') || name.includes('soccer') || 
      name.includes('volleyball') || name.includes('baseball') ||
      name.includes('football') || name.includes('lacrosse') ||
      name.includes('rugby')) {
    activityType = 'Team Sports';
    if (name.includes('basketball')) {
      activitySubtype = 'Basketball';
    } else if (name.includes('soccer')) {
      activitySubtype = 'Soccer';
    } else if (name.includes('volleyball')) {
      activitySubtype = 'Volleyball';
    } else if (name.includes('baseball') || name.includes('t-ball')) {
      activitySubtype = 'Baseball';
    } else if (name.includes('football')) {
      activitySubtype = 'Football';
    } else if (name.includes('lacrosse')) {
      activitySubtype = 'Lacrosse';
    } else if (name.includes('rugby')) {
      activitySubtype = 'Rugby';
    } else {
      activitySubtype = 'Mixed Team Sports';
    }
    return { activityType, activitySubtype };
  }
  
  // Individual Sports (check name)
  if (name.includes('tennis') || name.includes('badminton') || 
      name.includes('squash') || name.includes('golf')) {
    activityType = 'Individual Sports';
    if (name.includes('tennis')) {
      activitySubtype = 'Tennis';
    } else if (name.includes('badminton')) {
      activitySubtype = 'Badminton';
    } else if (name.includes('squash')) {
      activitySubtype = 'Squash';
    } else if (name.includes('golf')) {
      activitySubtype = 'Golf';
    } else {
      activitySubtype = 'General Individual Sports';
    }
    return { activityType, activitySubtype };
  }
  
  // Gymnastics (check name)
  if (name.includes('gymnast') || name.includes('tumbl')) {
    activityType = 'Gymnastics';
    activitySubtype = 'General Gymnastics';
    return { activityType, activitySubtype };
  }
  
  // Martial Arts (check name)
  if (name.includes('martial') || name.includes('karate') || 
      name.includes('taekwondo') || name.includes('judo')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Mixed Martial Arts';
    return { activityType, activitySubtype };
  }
  
  // Dance (check name)
  if (name.includes('dance') || name.includes('ballet')) {
    activityType = 'Dance';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Dance');
    return { activityType, activitySubtype };
  }
  
  // Skating (check name)
  if (name.includes('skating') || name.includes('skate')) {
    activityType = 'Skating & Wheels';
    if (name.includes('figure')) {
      activitySubtype = 'Figure Skating';
    } else if (name.includes('hockey')) {
      activitySubtype = 'Hockey Skating';
    } else {
      activitySubtype = 'Ice Skating';
    }
    return { activityType, activitySubtype };
  }
  
  // Music (check name)
  if (name.includes('music') || name.includes('piano') || 
      name.includes('guitar') || name.includes('violin') || 
      name.includes('drum') || name.includes('sing')) {
    activityType = 'Music';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Music');
    return { activityType, activitySubtype };
  }
  
  // Visual Arts (check name)
  if (name.includes('art') || name.includes('paint') || 
      name.includes('draw') || name.includes('craft')) {
    activityType = 'Visual Arts';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Visual Arts');
    return { activityType, activitySubtype };
  }
  
  // Cooking (check name)
  if (name.includes('cook') || name.includes('culinary') || name.includes('bak')) {
    activityType = 'Culinary Arts';
    activitySubtype = name.includes('bak') ? 'Baking' : 'Cooking';
    return { activityType, activitySubtype };
  }
  
  // STEM (check name)
  if (name.includes('science') || name.includes('stem') || 
      name.includes('robot') || name.includes('coding')) {
    activityType = 'STEM';
    if (name.includes('robot')) {
      activitySubtype = 'Robotics';
    } else if (name.includes('coding')) {
      activitySubtype = 'Coding';
    } else {
      activitySubtype = 'Science';
    }
    return { activityType, activitySubtype };
  }
  
  // Drama & Theatre (check name)
  if (name.includes('drama') || name.includes('theatre') || name.includes('acting')) {
    activityType = 'Drama & Theatre';
    activitySubtype = 'General Theatre';
    return { activityType, activitySubtype };
  }
  
  // Fitness & Wellness (check name)
  if (name.includes('yoga') || name.includes('fitness') || 
      name.includes('pilates') || name.includes('zumba')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = detectSpecificSubtype(name, subcategory, 'Fitness & Wellness');
    return { activityType, activitySubtype };
  }
  
  // Default to Other if no match
  activityType = 'Other';
  // Try to identify specific types for "Other"
  const combined = `${name} ${subcategory}`.toLowerCase();
  if (combined.includes('parent') && combined.includes('child')) {
    activitySubtype = 'Parent & Child';
  } else if (combined.includes('birthday')) {
    activitySubtype = 'Birthday Parties';
  } else if (combined.includes('drop-in') || combined.includes('drop in')) {
    activitySubtype = 'Drop-in Programs';
  } else if (combined.includes('special event')) {
    activitySubtype = 'Special Events';
  } else if (combined.includes('workshop')) {
    activitySubtype = 'Workshops';
  } else if (combined.includes('club')) {
    activitySubtype = 'Clubs';
  } else if (combined.includes('leadership')) {
    activitySubtype = 'Leadership';
  } else if (combined.includes('volunteer')) {
    activitySubtype = 'Volunteer Programs';
  } else {
    activitySubtype = 'General Programs';
  }
  
  return { activityType, activitySubtype };
}

// Function to determine categories based on age and other factors
function determineCategories(activity) {
  const categories = [];
  const ageMin = activity.ageMin || 0;
  const ageMax = activity.ageMax || 99;
  const name = activity.name?.toLowerCase() || '';
  const subcategory = activity.subcategory?.toLowerCase() || '';
  const category = activity.category?.toLowerCase() || '';
  
  // Check if activity requires parent based on section/category
  const requiresParent = activity.requiresParent || 
                        category.includes('parent participation') ||
                        subcategory.includes('parent participation') ||
                        name.includes('parent & ') ||
                        name.includes('tot');
  
  // Age-based categories
  if (ageMax <= 1) {
    categories.push('baby-parent');
  } else if (ageMax <= 6) {
    if (requiresParent || name.includes('parent') || subcategory.includes('parent')) {
      categories.push('early-years-parent');
    } else {
      categories.push('early-years-solo');
    }
  }
  
  if (ageMin <= 13 && ageMax >= 5) {
    categories.push('school-age');
  }
  
  if (ageMin <= 18 && ageMax >= 10) {
    categories.push('youth');
  }
  
  // Return unique categories
  return [...new Set(categories)];
}

// Export functions for use in scraper and other scripts
module.exports = {
  mapActivityComprehensive,
  determineCategories,
  detectSpecificSubtype
};

// Run migration if called directly
if (require.main === module) {
  async function migrateAllActivities() {
    try {
      console.log('Starting comprehensive activity migration v3...\n');
      
      const activities = await prisma.activity.findMany({
        where: { isActive: true }
      });
      
      console.log(`Processing ${activities.length} activities...\n`);
      
      let updatedCount = 0;
      const stats = {
        byType: {},
        bySubtype: {},
        byCategory: {}
      };
      
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        const mapping = mapActivityComprehensive(activity);
        const categories = determineCategories(activity);
        
        // Update activity
        await prisma.activity.update({
          where: { id: activity.id },
          data: {
            activityType: mapping.activityType,
            activitySubtype: mapping.activitySubtype
          }
        });
        
        // Track statistics
        stats.byType[mapping.activityType] = (stats.byType[mapping.activityType] || 0) + 1;
        const subtypeKey = `${mapping.activityType}: ${mapping.activitySubtype}`;
        stats.bySubtype[subtypeKey] = (stats.bySubtype[subtypeKey] || 0) + 1;
        
        categories.forEach(cat => {
          stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
        });
        
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          process.stdout.write(`\rProcessed: ${updatedCount}/${activities.length}`);
        }
      }
      
      console.log(`\n\nMigration complete! Updated ${updatedCount} activities.\n`);
      
      // Display statistics
      console.log('Activities by Type:');
      Object.entries(stats.byType)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      
      console.log('\nTop Activity Subtypes:');
      Object.entries(stats.bySubtype)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .forEach(([subtype, count]) => {
          console.log(`  ${subtype}: ${count}`);
        });
        
    } catch (error) {
      console.error('Error during migration:', error);
    } finally {
      await prisma.$disconnect();
    }
  }
  
  migrateAllActivities();
}