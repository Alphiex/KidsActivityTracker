const { PrismaClient } = require('../generated/prisma');
const { mapActivityType } = require('./activityTypeMapper');

/**
 * Comprehensive Activity Categorization Algorithm
 * 
 * This system uses the existing comprehensive activityTypeMapper.js which contains
 * hundreds of keywords and patterns for accurate categorization of ALL 22 activity types.
 * 
 * Features:
 * - Complete coverage of all 22 ActivityTypes in database  
 * - Hundreds of keywords and pattern rules from existing mapper
 * - Detailed subtype mapping for precise categorization
 * - Proven categorization logic already in production
 */

class ComprehensiveActivityCategorizer {
  constructor() {
    this.prisma = new PrismaClient();
    this.typeCache = null;
    this.subtypeCache = null;
  }

  async loadTypeCaches() {
    if (!this.typeCache) {
      const types = await this.prisma.activityType.findMany();
      this.typeCache = {};
      types.forEach(t => {
        this.typeCache[t.code] = { id: t.id, name: t.name };
      });
    }

    if (!this.subtypeCache) {
      const subtypes = await this.prisma.activitySubtype.findMany({
        include: { activityType: true }
      });
      this.subtypeCache = {};
      subtypes.forEach(s => {
        this.subtypeCache[s.code] = { 
          id: s.id, 
          name: s.name, 
          typeId: s.activityTypeId,
          typeName: s.activityType.name 
        };
      });
    }
  }

  /**
   * Categorize a single activity using the comprehensive existing mapper
   */
  async categorizeActivity(activity) {
    console.log(`\n🔍 Categorizing: "${activity.name}"`);
    
    try {
      // Use the existing comprehensive mapper which has hundreds of keywords and patterns
      const result = await mapActivityType({
        name: activity.name || '',
        category: activity.category || '',
        subcategory: activity.subcategory || '',
        description: activity.description || ''
      });
      
      // Get type and subtype names for logging
      let typeName = 'Unknown';
      let subtypeName = null;
      
      if (result.activityTypeId) {
        await this.loadTypeCaches();
        // Find type name
        for (const [code, typeInfo] of Object.entries(this.typeCache)) {
          if (typeInfo.id === result.activityTypeId) {
            typeName = typeInfo.name;
            break;
          }
        }
        
        // Find subtype name
        if (result.activitySubtypeId) {
          for (const [code, subtypeInfo] of Object.entries(this.subtypeCache)) {
            if (subtypeInfo.id === result.activitySubtypeId) {
              subtypeName = subtypeInfo.name;
              break;
            }
          }
        }
      }
      
      console.log(`   ✅ COMPREHENSIVE MATCH: ${typeName}${subtypeName ? ` / ${subtypeName}` : ''}`);
      
      return {
        activityTypeId: result.activityTypeId,
        activitySubtypeId: result.activitySubtypeId,
        confidence: 'COMPREHENSIVE',
        matchedType: typeName,
        matchedSubtype: subtypeName
      };
      
    } catch (error) {
      console.error(`   ❌ Error categorizing activity: ${error.message}`);
      
      // Fallback to default
      await this.loadTypeCaches();
      const defaultType = this.typeCache['other-activity'];
      return {
        activityTypeId: defaultType?.id || null,
        activitySubtypeId: null,
        confidence: 'ERROR',
        matchedType: defaultType?.name || 'Other',
        matchedSubtype: null
      };
    }
  }

  /**
   * Process all activities in the database
   */
  async recategorizeAllActivities() {
    console.log('🚀 Starting comprehensive activity recategorization...');
    console.log('📋 Using existing activityTypeMapper.js with hundreds of keyword patterns');
    
    const stats = {
      total: 0,
      updated: 0,
      unchanged: 0,
      comprehensive: 0,
      errors: 0
    };

    // Get all activities
    const activities = await this.prisma.activity.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        subcategory: true,
        ageMin: true,
        ageMax: true,
        activityTypeId: true,
        activitySubtypeId: true
      }
    });
    
    console.log(`📊 Processing ${activities.length} activities with COMPLETE mapping coverage...`);
    stats.total = activities.length;

    // Process activities in batches
    const batchSize = 50; // Smaller batches since we're doing more complex processing
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activities.length / batchSize)} (${batch.length} activities)`);
      
      for (const activity of batch) {
        const categorization = await this.categorizeActivity(activity);
        
        // Check if categorization changed
        const typeChanged = activity.activityTypeId !== categorization.activityTypeId;
        const subtypeChanged = activity.activitySubtypeId !== categorization.activitySubtypeId;
        
        if (typeChanged || subtypeChanged) {
          await this.prisma.activity.update({
            where: { id: activity.id },
            data: {
              activityTypeId: categorization.activityTypeId,
              activitySubtypeId: categorization.activitySubtypeId,
              updatedAt: new Date()
            }
          });
          
          console.log(`   🔄 UPDATED: ${activity.name}`);
          console.log(`      OLD: Type ${activity.activityTypeId} / Subtype ${activity.activitySubtypeId}`);
          console.log(`      NEW: Type ${categorization.activityTypeId} / Subtype ${categorization.activitySubtypeId}`);
          stats.updated++;
        } else {
          stats.unchanged++;
        }
        
        // Track confidence statistics
        if (categorization.confidence === 'COMPREHENSIVE') {
          stats.comprehensive++;
        } else if (categorization.confidence === 'ERROR') {
          stats.errors++;
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE RECATEGORIZATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total activities processed: ${stats.total}`);
    console.log(`Activities updated: ${stats.updated}`);
    console.log(`Activities unchanged: ${stats.unchanged}`);
    console.log(`Comprehensive matches: ${stats.comprehensive}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Update percentage: ${((stats.updated / stats.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    return stats;
  }

  /**
   * Verify categorization results with comprehensive coverage
   */
  async verifyCategorization() {
    console.log('\n🔍 COMPREHENSIVE VERIFICATION:');
    
    // Show type distribution after recategorization
    const typeDistribution = await this.prisma.activityType.findMany({
      select: {
        name: true,
        code: true,
        _count: {
          select: {
            activities: true
          }
        }
      },
      orderBy: {
        activities: {
          _count: 'desc'
        }
      }
    });

    console.log('📈 ALL ACTIVITY TYPES AFTER COMPREHENSIVE RECATEGORIZATION:');
    typeDistribution.forEach((type, index) => {
      const count = type._count.activities;
      const status = count > 0 ? '✅' : '⚠️';
      console.log(`${index + 1}. ${status} ${type.name}: ${count} activities`);
    });

    // Show sample activities for major types
    console.log('\n📋 SAMPLE ACTIVITIES BY TYPE:');
    for (const type of typeDistribution.slice(0, 10)) {
      if (type._count.activities > 0) {
        const sampleActivities = await this.prisma.activity.findMany({
          where: {
            activityType: {
              code: type.code
            }
          },
          select: {
            name: true,
            activitySubtype: {
              select: { name: true }
            }
          },
          take: 3,
          orderBy: { updatedAt: 'desc' }
        });
        
        console.log(`\n${type.name} (${type._count.activities} activities):`);
        sampleActivities.forEach(activity => {
          console.log(`  - ${activity.name}${activity.activitySubtype ? ` [${activity.activitySubtype.name}]` : ''}`);
        });
      }
    }

    // Check for any uncategorized activities
    const uncategorized = await this.prisma.activity.count({
      where: {
        activityTypeId: null
      }
    });

    if (uncategorized > 0) {
      console.log(`\n⚠️ ${uncategorized} activities remain uncategorized`);
    } else {
      console.log('\n✅ ALL activities have been categorized!');
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = { ComprehensiveActivityCategorizer };