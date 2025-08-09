const { PrismaClient } = require('./generated/prisma');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    console.log('Creating database backup...\n');
    
    // Export all data
    const data = {
      timestamp,
      providers: await prisma.provider.findMany(),
      locations: await prisma.location.findMany(),
      activities: await prisma.activity.findMany(),
      users: await prisma.user.findMany(),
      favorites: await prisma.favorite.findMany(),
      activityHistory: await prisma.activityHistory.findMany(),
      scrapeJobs: await prisma.scrapeJob.findMany()
    };
    
    const filename = path.join(backupDir, `backup-${timestamp}.json`);
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    
    console.log(`Backup created: ${filename}`);
    console.log('\nBackup summary:');
    console.log('===============');
    console.log(`Providers: ${data.providers.length}`);
    console.log(`Locations: ${data.locations.length}`);
    console.log(`Activities: ${data.activities.length}`);
    console.log(`Users: ${data.users.length}`);
    console.log(`Favorites: ${data.favorites.length}`);
    console.log(`Activity History: ${data.activityHistory.length}`);
    console.log(`Scrape Jobs: ${data.scrapeJobs.length}`);
    
    return filename;
    
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backupDatabase };