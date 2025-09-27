#!/usr/bin/env node

/**
 * Data Migration Script: Normalize Locations and Create Cities
 * 
 * This script migrates the existing location data to the new normalized schema:
 * 1. Creates City records from existing location data
 * 2. Consolidates duplicate Location records  
 * 3. Updates Activity records to reference consolidated locations
 * 4. Adds Apple Maps integration data where possible
 */

const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting location normalization migration...');
  
  try {
    // Step 1: Create Cities from existing Location data
    console.log('\n📍 Step 1: Creating Cities from existing locations...');
    
    const existingLocations = await prisma.location.findMany({
      select: {
        city: true,
        province: true,
        country: true
      },
      distinct: ['city', 'province', 'country']
    });
    
    console.log(`Found ${existingLocations.length} unique city combinations`);
    
    const cityMap = new Map();
    
    for (const loc of existingLocations) {
      if (!loc.city) continue; // Skip null cities
      
      const cityKey = `${loc.city}-${loc.province}-${loc.country}`;
      
      if (!cityMap.has(cityKey)) {
        const city = await prisma.city.upsert({
          where: {
            name_province_country: {
              name: loc.city,
              province: loc.province,
              country: loc.country || 'Canada'
            }
          },
          update: {},
          create: {
            name: loc.city,
            province: loc.province,
            country: loc.country || 'Canada'
          }
        });
        
        cityMap.set(cityKey, city.id);
        console.log(`✅ Created/found city: ${loc.city}, ${loc.province}`);
      }
    }
    
    // Step 2: Consolidate duplicate locations and update with cityId
    console.log('\n🏢 Step 2: Consolidating duplicate locations...');
    
    // Get all existing locations with their activities count
    const locations = await prisma.location.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });
    
    console.log(`Processing ${locations.length} existing locations...`);
    
    // Group locations by name and city to find duplicates
    const locationGroups = new Map();
    
    for (const location of locations) {
      const cityKey = `${location.city}-${location.province}-${location.country}`;
      const cityId = cityMap.get(cityKey);
      
      if (!cityId) {
        console.warn(`⚠️ No city found for location: ${location.name} in ${location.city}`);
        continue;
      }
      
      const locationKey = `${location.name}-${cityId}`;
      
      if (!locationGroups.has(locationKey)) {
        locationGroups.set(locationKey, []);
      }
      
      locationGroups.get(locationKey).push({
        ...location,
        cityId
      });
    }
    
    console.log(`Found ${locationGroups.size} unique location groups`);
    
    // Step 3: Process each location group
    const locationMapping = new Map(); // oldLocationId -> newLocationId
    
    for (const [locationKey, duplicateLocations] of locationGroups) {
      if (duplicateLocations.length === 0) continue;
      
      // Sort by activity count descending to keep the location with most activities as primary
      duplicateLocations.sort((a, b) => b._count.activities - a._count.activities);
      const primaryLocation = duplicateLocations[0];
      
      console.log(`\n📍 Processing location group: ${primaryLocation.name}`);
      console.log(`  - ${duplicateLocations.length} duplicate locations found`);
      console.log(`  - Primary location: ${primaryLocation.id} (${primaryLocation._count.activities} activities)`);
      
      // Create/update the normalized location
      const fullAddress = `${primaryLocation.address || ''} ${primaryLocation.city} ${primaryLocation.province} ${primaryLocation.postalCode || ''}`.trim();
      
      const normalizedLocation = await prisma.location.upsert({
        where: {
          name_address_cityId: {
            name: primaryLocation.name,
            address: primaryLocation.address || '',
            cityId: primaryLocation.cityId
          }
        },
        update: {
          // Update with best available data
          address: primaryLocation.address || null,
          postalCode: primaryLocation.postalCode,
          latitude: primaryLocation.latitude,
          longitude: primaryLocation.longitude,
          facility: primaryLocation.facility,
          fullAddress: fullAddress || null,
          // TODO: Add Apple Maps URL generation
          mapUrl: fullAddress ? `http://maps.apple.com/?q=${encodeURIComponent(fullAddress)}` : null
        },
        create: {
          name: primaryLocation.name,
          address: primaryLocation.address || null,
          cityId: primaryLocation.cityId,
          postalCode: primaryLocation.postalCode,
          latitude: primaryLocation.latitude,
          longitude: primaryLocation.longitude,
          facility: primaryLocation.facility,
          fullAddress: fullAddress || null,
          mapUrl: fullAddress ? `http://maps.apple.com/?q=${encodeURIComponent(fullAddress)}` : null
        }
      });
      
      // Map all duplicate location IDs to the normalized location ID
      for (const duplicate of duplicateLocations) {
        locationMapping.set(duplicate.id, normalizedLocation.id);
      }
      
      console.log(`  ✅ Created normalized location: ${normalizedLocation.id}`);
    }
    
    // Step 4: Update all Activity records to use normalized location IDs
    console.log('\n🔄 Step 4: Updating activity location references...');
    
    let updatedCount = 0;
    const batchSize = 1000;
    
    for (const [oldLocationId, newLocationId] of locationMapping) {
      const updated = await prisma.activity.updateMany({
        where: { locationId: oldLocationId },
        data: { locationId: newLocationId }
      });
      
      updatedCount += updated.count;
      
      if (updated.count > 0) {
        console.log(`  ✅ Updated ${updated.count} activities: ${oldLocationId} -> ${newLocationId}`);
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`  - Cities created: ${cityMap.size}`);
    console.log(`  - Locations normalized: ${locationGroups.size}`);
    console.log(`  - Activities updated: ${updatedCount}`);
    
    // Step 5: Clean up old duplicate location records
    console.log('\n🧹 Step 5: Cleaning up duplicate location records...');
    
    const oldLocationIds = Array.from(locationMapping.keys());
    const keptLocationIds = Array.from(new Set(locationMapping.values()));
    const toDelete = oldLocationIds.filter(id => !keptLocationIds.includes(id));
    
    if (toDelete.length > 0) {
      // First check if any activities still reference these locations
      const activitiesStillReferencing = await prisma.activity.count({
        where: {
          locationId: { in: toDelete }
        }
      });
      
      if (activitiesStillReferencing === 0) {
        const deleted = await prisma.location.deleteMany({
          where: {
            id: { in: toDelete }
          }
        });
        
        console.log(`  ✅ Deleted ${deleted.count} duplicate location records`);
      } else {
        console.log(`  ⚠️ Cannot delete locations - ${activitiesStillReferencing} activities still reference them`);
      }
    }
    
    console.log('\n🎉 Location normalization migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });