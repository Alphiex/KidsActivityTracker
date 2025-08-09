const { PrismaClient } = require('./generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function uploadScrapedData() {
  console.log('🚀 Starting scraped data upload...');
  
  try {
    // Find the most recent JSON file from local scraping
    const files = fs.readdirSync('.')
      .filter(f => f.startsWith('nvrc_working_hierarchical_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.error('❌ No scraped data files found!');
      console.log('Please run the local scraper first.');
      return;
    }
    
    // Use the specific file with 1700 activities
    const targetFile = 'nvrc_working_hierarchical_2025-08-03T20-32-27-985Z.json';
    const latestFile = fs.existsSync(targetFile) ? targetFile : files[0];
    console.log(`📄 Using data file: ${latestFile}`);
    
    // Read the scraped data
    const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    const activities = data.activities || [];
    
    console.log(`📊 Found ${activities.length} activities in file`);
    console.log(`📅 Scraped at: ${data.timestamp}`);
    
    if (activities.length === 0) {
      console.error('❌ No activities in file!');
      return;
    }
    
    // Get current activities from database
    const currentActivities = await prisma.activity.findMany({
      where: { organizationId: 'nvrc' }
    });
    
    console.log(`📊 Current activities in database: ${currentActivities.length}`);
    
    // Create map for efficient lookups
    const currentActivitiesMap = new Map();
    currentActivities.forEach(activity => {
      if (activity.externalId) {
        currentActivitiesMap.set(activity.externalId, activity);
      }
    });
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    // Process each activity
    for (const activity of activities) {
      try {
        // Use the unique ID from the scraper
        const externalId = activity.id || activity.courseId;
        const existingActivity = currentActivitiesMap.get(externalId);
        
        // Prepare activity data
        const activityData = {
          name: activity.name || 'Unnamed Activity',
          organizationId: 'nvrc',
          externalId: externalId,
          category: activity.categoryName || activity.category || 'General',
          subcategory: activity.serviceName || activity.subcategory || null,
          description: [
            activity.name,
            activity.instructor ? `Instructor: ${activity.instructor}` : null,
            activity.dates,
            activity.times || activity.time,
            activity.location,
            activity.price,
            activity.spotsRemaining ? `${activity.spotsRemaining} spots remaining` : null
          ].filter(Boolean).join('\n'),
          location: activity.location || 'TBD',
          dates: activity.dates || activity.date || 'Ongoing',
          times: activity.times || activity.time || 'Various',
          price: activity.price || 'Contact for pricing',
          registrationRequired: true,
          registrationUrl: activity.registerUrl || activity.registrationUrl || 'https://www.nvrc.ca/programs-memberships/find-program',
          ageRange: activity.ageRange || activity.ageInfo || 'All Ages',
          tags: [
            activity.categoryName || activity.category,
            activity.serviceName,
            activity.location,
            activity.instructor
          ].filter(Boolean),
          isActive: activity.spotsRemaining !== '0' && activity.status !== 'closed',
          lastScraped: new Date(),
          rawData: activity
        };
        
        if (existingActivity) {
          // Update existing activity
          await prisma.activity.update({
            where: { id: existingActivity.id },
            data: activityData
          });
          updated++;
          
          // Remove from map
          currentActivitiesMap.delete(externalId);
        } else {
          // Create new activity
          await prisma.activity.create({
            data: activityData
          });
          created++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing activity ${activity.name}:`, error.message);
        errors++;
      }
    }
    
    // Mark remaining activities as inactive
    const toMarkInactive = Array.from(currentActivitiesMap.values());
    if (toMarkInactive.length > 0) {
      console.log(`\n📝 Marking ${toMarkInactive.length} old activities as inactive...`);
      
      await prisma.activity.updateMany({
        where: {
          id: {
            in: toMarkInactive.map(a => a.id)
          }
        },
        data: {
          isActive: false,
          lastScraped: new Date()
        }
      });
    }
    
    console.log('\n📊 Upload complete:');
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📝 Marked inactive: ${toMarkInactive.length}`);
    
    // Get final count
    const finalCount = await prisma.activity.count({
      where: { 
        organizationId: 'nvrc',
        isActive: true
      }
    });
    
    console.log(`\n📊 Total active NVRC activities in database: ${finalCount}`);
    
    // Create a deployment marker file
    const deploymentData = {
      timestamp: new Date().toISOString(),
      source: latestFile,
      activitiesUploaded: activities.length,
      created: created,
      updated: updated,
      errors: errors,
      markedInactive: toMarkInactive.length,
      totalActive: finalCount
    };
    
    fs.writeFileSync(
      `deployment_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log('\n✅ Deployment marker created');
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the upload
uploadScrapedData()
  .then(() => {
    console.log('\n✅ Upload completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Upload failed:', error);
    process.exit(1);
  });