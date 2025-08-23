#!/usr/bin/env node

const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function addMissingLocation() {
  try {
    // Check if Lynn Valley Village Community Complex exists
    const existing = await prisma.location.findFirst({
      where: { 
        OR: [
          { name: 'Lynn Valley Village Community Complex' },
          { name: { contains: 'Lynn Valley Village' } }
        ]
      }
    });
    
    if (existing) {
      console.log('Found existing:', existing.name);
      if (existing.name !== 'Lynn Valley Village Community Complex') {
        await prisma.location.update({
          where: { id: existing.id },
          data: { name: 'Lynn Valley Village Community Complex' }
        });
        console.log('✅ Updated to canonical name');
      }
    } else {
      const newLocation = await prisma.location.create({
        data: {
          name: 'Lynn Valley Village Community Complex',
          address: '',
          city: 'North Vancouver',
          province: 'BC',
          postalCode: '',
          facility: 'Community Centre'
        }
      });
      console.log('✅ Created Lynn Valley Village Community Complex');
    }
    
    const count = await prisma.location.count();
    console.log('\nTotal locations now:', count);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingLocation();