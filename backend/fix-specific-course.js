#!/usr/bin/env node

const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function fixSpecificCourse() {
  try {
    console.log('Fixing course 00371053 data...');
    
    // Update the activity with correct data
    const result = await prisma.activity.update({
      where: {
        id: '1bcb2409-51f8-40ae-b1d9-1e5c3e8040ef'
      },
      data: {
        courseId: '00371053',  // Fix: Use site's course ID, not internal ID
        registrationStatus: 'Open',  // Fix: Should be Open, not Unknown
        spotsAvailable: 11,  // Fix: Should be 11, not 0
        dateStart: new Date(2025, 9, 18),  // Oct 18, 2025
        dateEnd: new Date(2025, 9, 18),    // Oct 18, 2025
        description: 'Receive instruction in child care, safety procedures and activities for young children. Must be 11yrs old by the last class and attend all sessions and meet competency requirements to receive the certification. Extra fee for manual.',
        schedule: 'Sat 09:00 am - 04:00 pm',
        cost: 65.00,
        registrationDate: new Date(2025, 9, 18, 9, 0)  // Registration ends Oct 18, 2025 at 9:00 AM
      }
    });
    
    console.log('✅ Updated activity:', result.name);
    console.log('   Course ID:', result.courseId);
    console.log('   Status:', result.registrationStatus);
    console.log('   Spots:', result.spotsAvailable);
    console.log('   Date:', result.dateStart);
    
    // Check if ActivitySession table exists and create session
    try {
      // First delete any existing sessions
      await prisma.activitySession.deleteMany({
        where: { activityId: result.id }
      });
      
      // Create the session
      const session = await prisma.activitySession.create({
        data: {
          activityId: result.id,
          sessionNumber: 1,
          date: 'Sat 10/18/25',
          startTime: '09:00 AM',
          endTime: '04:00 PM',
          location: 'Second Floor Multipurpose Room',
          dayOfWeek: 'Sat'
        }
      });
      
      console.log('✅ Created session:', session.date);
    } catch (error) {
      if (error.code === 'P2021') {
        console.log('⚠️  ActivitySession table not found, skipping session creation');
      } else {
        throw error;
      }
    }
    
    // Check if ActivityPrerequisite table exists and create required extra
    try {
      // First delete any existing prerequisites
      await prisma.activityPrerequisite.deleteMany({
        where: { activityId: result.id }
      });
      
      // Create the required extra as a prerequisite
      const extra = await prisma.activityPrerequisite.create({
        data: {
          activityId: result.id,
          name: 'Babysitters Training Manual',
          description: 'Required: $10.00 Plus Tax',
          isRequired: true
        }
      });
      
      console.log('✅ Created required extra:', extra.name);
    } catch (error) {
      if (error.code === 'P2021') {
        console.log('⚠️  ActivityPrerequisite table not found, skipping prerequisite creation');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSpecificCourse();