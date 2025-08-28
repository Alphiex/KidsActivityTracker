#!/usr/bin/env node

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function fixParkgateLocation() {
  console.log('Fixing Parkgate Community Centre location...');
  
  try {
    // Update the location with correct address and coordinates
    const result = await prisma.location.updateMany({
      where: {
        name: {
          contains: 'Parkgate',
          mode: 'insensitive'
        }
      },
      data: {
        address: '3625 Banff Court',
        city: 'North Vancouver',
        province: 'BC',
        postalCode: 'V7H 2Z8',
        latitude: 49.3315,
        longitude: -123.0424
      }
    });
    
    console.log(`Updated ${result.count} Parkgate location records`);
    
    // Also update any activities with Parkgate in the name
    const activityResult = await prisma.activity.updateMany({
      where: {
        locationName: {
          contains: 'Parkgate',
          mode: 'insensitive'
        }
      },
      data: {
        fullAddress: '3625 Banff Court, North Vancouver, BC V7H 2Z8'
      }
    });
    
    console.log(`Updated ${activityResult.count} activity records with Parkgate address`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixParkgateLocation();