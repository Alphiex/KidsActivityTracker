const express = require('express');
const router = express.Router();
const prisma = require('../database/config/database');

// Test database schema
router.get('/schema-check', async (req, res) => {
  try {
    // Check if dates column exists
    const columnCheck = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Activity' 
      AND column_name IN ('dates', 'registrationStatus', 'fullDescription')
    `;
    
    // Try a simple query
    const simpleActivity = await prisma.activity.findFirst({
      select: {
        id: true,
        name: true
      }
    });
    
    // Get database connection info (without sensitive data)
    const dbUrl = process.env.DATABASE_URL || '';
    const dbInfo = {
      hasConnection: !!dbUrl,
      isCloudSQL: dbUrl.includes('cloudsql'),
      host: dbUrl.split('@')[1]?.split('/')[0] || 'unknown'
    };
    
    res.json({
      success: true,
      columns: columnCheck,
      simpleQuery: !!simpleActivity,
      activityName: simpleActivity?.name,
      dbInfo,
      prismaVersion: prisma._clientVersion || 'unknown'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;