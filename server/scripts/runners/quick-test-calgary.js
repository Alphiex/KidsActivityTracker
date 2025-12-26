#!/usr/bin/env node

const ScraperFactory = require('../scrapers/base/ScraperFactory');
const { PrismaClient } = require('../generated/prisma');

async function test() {
  console.log('Quick test of Calgary scraper with monthly iteration...\n');
  
  const prisma = new PrismaClient();
  const config = require('../scrapers/configs/providers/calgary.json');
  const scraper = ScraperFactory.createScraper(config);
  scraper.prisma = prisma;

  const startTime = Date.now();
  
  try {
    const rawActivities = await scraper.extractActivities();
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n=== RESULTS ===');
    console.log(`Total activities extracted: ${rawActivities.length}`);
    console.log(`Duration: ${duration} minutes`);
    
    // Show breakdown by month
    const byMonth = {};
    rawActivities.forEach(a => {
      const month = a.sourceMonth || 'unknown';
      byMonth[month] = (byMonth[month] || 0) + 1;
    });
    
    console.log('\nBy month:');
    Object.entries(byMonth).sort().forEach(([month, count]) => {
      console.log(`  ${month}: ${count}`);
    });
    
  } catch (e) {
    console.error('Error:', e);
  }
  
  await prisma.$disconnect();
}

test().catch(console.error);
