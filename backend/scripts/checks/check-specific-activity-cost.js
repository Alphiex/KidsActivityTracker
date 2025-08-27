#!/usr/bin/env node
require('dotenv').config({ path: '../.env.production' });
const { PrismaClient } = require('./generated/prisma');

async function checkActivity() {
  const prisma = new PrismaClient();
  
  try {
    // Find activity with courseId 00369210
    const activity = await prisma.activity.findFirst({
      where: {
        courseId: '00369210'
      },
      include: {
        provider: true,
        location: true
      }
    });
    
    if (activity) {
      console.log('\n📍 Found Activity:');
      console.log('Name:', activity.name);
      console.log('Course ID:', activity.courseId);
      console.log('External ID:', activity.externalId);
      console.log('Cost:', activity.cost);
      console.log('Cost Includes Tax:', activity.costIncludesTax);
      console.log('Tax Amount:', activity.taxAmount);
      console.log('Registration URL:', activity.registrationUrl);
      console.log('Detail URL:', activity.detailUrl);
      console.log('Last Updated:', activity.updatedAt);
      console.log('Last Seen:', activity.lastSeenAt);
      
      if (activity.rawData) {
        console.log('\n📦 Raw Data Cost Info:');
        const raw = activity.rawData;
        console.log('Raw cost:', raw.cost);
        console.log('Raw price:', raw.price);
        console.log('Raw costIncludesTax:', raw.costIncludesTax);
      }
    } else {
      console.log('❌ Activity with courseId 00369210 not found');
      
      // Search by name pattern
      const swimActivities = await prisma.activity.findMany({
        where: {
          name: {
            contains: 'Swim Private',
            mode: 'insensitive'
          }
        },
        select: {
          name: true,
          courseId: true,
          cost: true,
          costIncludesTax: true,
          updatedAt: true
        }
      });
      
      console.log('\n🏊 Found Swim Private activities:');
      swimActivities.forEach(act => {
        console.log(`- ${act.name} (${act.courseId}): $${act.cost} ${act.costIncludesTax ? '(incl tax)' : '(+ tax)'} - Updated: ${act.updatedAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivity();