const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Mapping from old activity type names to new ones
const activityTypeMapping = {
  // Old → New
  'Swimming': 'Swimming & Aquatics',
  'Swimming Lessons': 'Swimming & Aquatics',
  'Sports - Team': 'Team Sports',
  'Sports - Individual': 'Individual Sports',
  'Arts': 'Visual Arts',
  'Arts - Visual': 'Visual Arts',
  'Arts & Crafts': 'Visual Arts',
  'Arts - Music': 'Music',
  'Arts - Performing': 'Performing Arts',
  'Drama': 'Performing Arts',
  'Theatre': 'Performing Arts',
  'Theater': 'Performing Arts',
  'Skating': 'Skating & Wheels',
  'Skate': 'Skating & Wheels',
  'Gymnastics': 'Gymnastics & Movement',
  'Day Camps': 'Camps',
  'Summer Camp': 'Camps',
  'School Programs': 'Camps',
  'STEM': 'STEM & Education',
  'STEM & Academic': 'STEM & Education',
  'Academic': 'STEM & Education',
  'Educational': 'STEM & Education',
  'Fitness': 'Fitness & Wellness',
  'Outdoor': 'Outdoor & Adventure',
  'Outdoor Adventure': 'Outdoor & Adventure',
  'Adventure': 'Outdoor & Adventure',
  'Cooking': 'Culinary Arts',
  'Languages': 'Language & Culture',
  'Language': 'Language & Culture',
  'Special Needs': 'Special Needs Programs',
  'Special Needs & Adaptive': 'Special Needs Programs',
  'General Programs': 'Multi-Sport',
  'Multi Sport': 'Multi-Sport',
  'Certifications & Leadership': 'Life Skills & Leadership',
  'Leadership': 'Life Skills & Leadership',
  'Learn & Play': 'Early Development',
  'Parent & Tot': 'Early Development',
  'Baby & Me': 'Early Development'
};

async function updateChildInterests() {
  console.log('🔄 Updating child interests to new activity types...\n');
  
  try {
    // Get all children with interests
    const children = await prisma.child.findMany({
      where: {
        NOT: {
          interests: { isEmpty: true }
        }
      },
      select: {
        id: true,
        name: true,
        interests: true
      }
    });
    
    console.log(`Found ${children.length} children with interests to update\n`);
    
    let updatedCount = 0;
    
    for (const child of children) {
      const originalInterests = child.interests;
      const updatedInterests = [];
      let hasChanges = false;
      
      for (const interest of originalInterests) {
        if (activityTypeMapping[interest]) {
          updatedInterests.push(activityTypeMapping[interest]);
          hasChanges = true;
          console.log(`  ${child.name}: "${interest}" → "${activityTypeMapping[interest]}"`);
        } else {
          updatedInterests.push(interest);
        }
      }
      
      // Remove duplicates
      const uniqueInterests = [...new Set(updatedInterests)];
      
      if (hasChanges) {
        await prisma.child.update({
          where: { id: child.id },
          data: { interests: uniqueInterests }
        });
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Updated interests for ${updatedCount} children`);
    
    // Show summary of new interests
    const updatedChildren = await prisma.child.findMany({
      select: { interests: true }
    });
    
    const allInterests = new Set();
    updatedChildren.forEach(c => {
      if (c.interests) {
        c.interests.forEach(i => allInterests.add(i));
      }
    });
    
    console.log('\n📊 All unique interests after update:');
    Array.from(allInterests).sort().forEach(i => console.log(`  - ${i}`));
    
  } catch (error) {
    console.error('❌ Error updating interests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function updateUserPreferences() {
  console.log('\n🔄 Updating user preferences to new activity types...\n');
  
  try {
    // Get all users with preferences
    const users = await prisma.user.findMany({
      where: {
        preferences: { not: {} }
      },
      select: {
        id: true,
        email: true,
        preferences: true
      }
    });
    
    console.log(`Found ${users.length} users with preferences\n`);
    
    let updatedCount = 0;
    
    for (const user of users) {
      const prefs = user.preferences;
      let hasChanges = false;
      
      // Update preferredCategories if it exists
      if (prefs.preferredCategories && Array.isArray(prefs.preferredCategories)) {
        const updatedCategories = prefs.preferredCategories.map(cat => {
          if (activityTypeMapping[cat]) {
            hasChanges = true;
            console.log(`  ${user.email}: "${cat}" → "${activityTypeMapping[cat]}"`);
            return activityTypeMapping[cat];
          }
          return cat;
        });
        
        prefs.preferredCategories = [...new Set(updatedCategories)];
      }
      
      // Update activityTypes if it exists
      if (prefs.activityTypes && Array.isArray(prefs.activityTypes)) {
        const updatedTypes = prefs.activityTypes.map(type => {
          if (activityTypeMapping[type]) {
            hasChanges = true;
            console.log(`  ${user.email}: "${type}" → "${activityTypeMapping[type]}"`);
            return activityTypeMapping[type];
          }
          return type;
        });
        
        prefs.activityTypes = [...new Set(updatedTypes)];
      }
      
      if (hasChanges) {
        await prisma.user.update({
          where: { id: user.id },
          data: { preferences: prefs }
        });
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Updated preferences for ${updatedCount} users`);
    
  } catch (error) {
    console.error('❌ Error updating user preferences:', error);
  }
}

// Run both updates
async function main() {
  await updateChildInterests();
  await updateUserPreferences();
  await prisma.$disconnect();
}

main().catch(console.error);